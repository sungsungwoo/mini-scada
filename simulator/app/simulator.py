#!/usr/bin/env python3
"""
Minimal Modbus TCP simulator for Mini SCADA local development.
- Listens on MODBUS_PORT (default 5020). Use 5020 in Docker to avoid host port 502 conflicts.
- Seeds holding registers (function code 3) at address 0..2 with sample values.
"""
from __future__ import annotations

import logging
import os

from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartTcpServer


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    port = int(os.environ.get("MODBUS_PORT", "5020"))
    host = os.environ.get("MODBUS_BIND", "0.0.0.0")

    hr = ModbusSequentialDataBlock(0, [0] * 10000)
    # Example process values (16-bit): temperature-like counts x100
    hr.setValues(0, [2500, 1050, 3200])

    store = ModbusSlaveContext(
        di=ModbusSequentialDataBlock(0, [0] * 100),
        co=ModbusSequentialDataBlock(0, [0] * 100),
        hr=hr,
        ir=ModbusSequentialDataBlock(0, [0] * 100),
    )
    context = ModbusServerContext(slaves=store, single=True)

    logging.info("Mini SCADA Modbus TCP simulator listening on %s:%s", host, port)
    StartTcpServer(context=context, address=(host, port))


if __name__ == "__main__":
    main()
