#!/usr/bin/env python3
"""
Minimal Modbus TCP simulator for Mini SCADA local development.
- Listens on MODBUS_PORT (default 5020). Use 5020 in Docker to avoid host port 502 conflicts.
- Unit IDs 1 / 2 / 3: holding registers match `V8__seed_dashboard_demo_devices` (MODBUS_TCP on :5020).
  FLOAT32 two words per tag — aligns with backend `ModbusValueParser` + byte_order `BIG`.
- Values are randomized on an interval (see SIMULATOR_RANDOM_INTERVAL_SEC).
- TCP connection/disconnect: INFO (`LoggingModbusServerRequestHandler`).
- Modbus PDU: INFO (`request_tracer`). Raw bytes: SIMULATOR_PYMODBUS_DEBUG=1.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import random
import struct

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.framer import Framer
from pymodbus.logging import Log as PymodbusLog
from pymodbus.server.async_io import (
    ModbusServerRequestHandler,
    ModbusTcpServer,
    _serverList,
)

LOG = logging.getLogger("mini_scada.simulator")

# --- Mirrors backend/src/main/resources/db/migration/V8__seed_dashboard_demo_devices.sql ---
# MODBUS_TCP devices on 127.0.0.1:5020: Boiler-01 slave 1, Chiller-01 slave 2, Chiller-02 slave 3.
# FC3 holding register start addresses (FLOAT32 → 2 words each).
SLAVE_FLOAT32_ADDRESSES: dict[int, tuple[int, ...]] = {
    1: (100, 102),  # Steam Pressure, Feed Temp
    2: (200, 202),  # Outlet Temp, Return Pressure
    3: (300,),  # Outlet Temp only
}

# (min, max) for random.uniform — rough physical ranges for demo / alarm play.
FLOAT32_BOUNDS: dict[int, tuple[float, float]] = {
    100: (5.0, 10.5),  # bar
    102: (90.0, 140.0),  # °C
    200: (4.0, 14.0),  # °C
    202: (1.5, 4.8),  # bar
    300: (8.0, 18.0),  # °C
}


class LoggingModbusServerRequestHandler(ModbusServerRequestHandler):
    """수락된 TCP 연결마다 peer 주소를 남김 — 백엔드가 172.31.x.x:5020 으로 붙었는지 확인용."""

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        peer = None
        try:
            peer = transport.get_extra_info("peername")
        except OSError:
            peer = "(unknown)"
        LOG.info("TCP connected peer=%s", peer)
        super().connection_made(transport)

    def connection_lost(self, exc: Exception | None) -> None:
        LOG.info("TCP disconnected peer lost_exc=%s", exc)
        super().connection_lost(exc)


class LoggingModbusTcpServer(ModbusTcpServer):
    def callback_new_connection(self):
        return LoggingModbusServerRequestHandler(self)


def float32_to_hr_words(value: float) -> tuple[int, int]:
    """백엔드 FLOAT32 디코딩: combined = (w0 << 16) | w1, big-endian float bits."""
    raw = struct.pack(">f", value)
    w0 = (raw[0] << 8) | raw[1]
    w1 = (raw[2] << 8) | raw[3]
    return w0, w1


def write_float32_hr(hr: ModbusSequentialDataBlock, start_addr: int, value: float) -> None:
    w0, w1 = float32_to_hr_words(value)
    hr.setValues(start_addr, [w0, w1])


def randomize_seeded_registers(hr_by_slave: dict[int, ModbusSequentialDataBlock]) -> None:
    """시드에 정의된 slave 1/2/3 태그만 랜덤 갱신."""
    for slave_id, hr in hr_by_slave.items():
        addrs = SLAVE_FLOAT32_ADDRESSES.get(slave_id, ())
        for addr in addrs:
            lo, hi = FLOAT32_BOUNDS.get(addr, (0.0, 100.0))
            write_float32_hr(hr, addr, random.uniform(lo, hi))
        # 하위 호환 스모크: slave 1 만 레지스터 0..2 (정수 워드)
        if slave_id == 1:
            hr.setValues(
                0,
                [
                    random.randint(2000, 3200),
                    random.randint(800, 1200),
                    random.randint(2500, 4000),
                ],
            )


def modbus_request_tracer(request, *addr) -> None:
    """pymodbus 서버: 디코딩된 Modbus 요청마다 호출(백엔드 연결 테스트·폴링 시 여기에 찍힘)."""
    slave = getattr(request, "slave_id", None)
    fc = getattr(request, "function_code", None)
    fc_name = getattr(request, "function_code_name", None)
    detail = ""
    if hasattr(request, "address") and hasattr(request, "count"):
        detail = f" address={request.address} count={request.count}"
    elif hasattr(request, "address"):
        detail = f" address={request.address}"
    extra_addr = f" udp_addr={addr}" if addr else ""
    LOG.info(
        "Modbus request: slave_id=%s function_code=%s (%s)%s%s",
        slave,
        fc,
        fc_name or type(request).__name__,
        detail,
        extra_addr,
    )


async def randomize_loop(hr_by_slave: dict[int, ModbusSequentialDataBlock], interval_sec: float) -> None:
    while True:
        randomize_seeded_registers(hr_by_slave)
        await asyncio.sleep(interval_sec)


def _make_slave_context() -> tuple[ModbusSlaveContext, ModbusSequentialDataBlock]:
    hr = ModbusSequentialDataBlock(0, [0] * 10000)
    store = ModbusSlaveContext(
        di=ModbusSequentialDataBlock(0, [0] * 100),
        co=ModbusSequentialDataBlock(0, [0] * 100),
        hr=hr,
        ir=ModbusSequentialDataBlock(0, [0] * 100),
        zero_mode=True,
    )
    return store, hr


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    if os.environ.get("SIMULATOR_PYMODBUS_DEBUG", "").lower() in ("1", "true", "yes"):
        PymodbusLog.setLevel(logging.DEBUG)
        LOG.info("SIMULATOR_PYMODBUS_DEBUG: pymodbus internal logging at DEBUG")

    port = int(os.environ.get("MODBUS_PORT", "5020"))
    host = os.environ.get("MODBUS_BIND", "0.0.0.0")
    interval = float(os.environ.get("SIMULATOR_RANDOM_INTERVAL_SEC", "1.5"))

    slaves: dict[int, ModbusSlaveContext] = {}
    hr_by_slave: dict[int, ModbusSequentialDataBlock] = {}
    for sid in (1, 2, 3):
        ctx, hr = _make_slave_context()
        slaves[sid] = ctx
        hr_by_slave[sid] = hr

    randomize_seeded_registers(hr_by_slave)

    context = ModbusServerContext(slaves=slaves, single=False)

    tag_counts = ", ".join(
        f"slave {k}: {len(v)} FLOAT32 tag(s) @ {v}" for k, v in SLAVE_FLOAT32_ADDRESSES.items()
    )
    LOG.info(
        "Mini SCADA Modbus TCP simulator on %s:%s — %s; randomize every %ss",
        host,
        port,
        tag_counts,
        interval,
    )

    async def _run() -> None:
        task = asyncio.create_task(randomize_loop(hr_by_slave, interval))
        try:
            server = LoggingModbusTcpServer(
                context,
                Framer.SOCKET,
                None,
                (host, port),
                request_tracer=modbus_request_tracer,
            )
            await _serverList.run(server, [])
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    asyncio.run(_run())


if __name__ == "__main__":
    main()
