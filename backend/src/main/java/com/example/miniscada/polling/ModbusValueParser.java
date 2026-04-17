package com.example.miniscada.polling;

import com.ghgande.j2mod.modbus.procimg.InputRegister;
import com.ghgande.j2mod.modbus.procimg.Register;
import com.ghgande.j2mod.modbus.procimg.SimpleRegister;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class ModbusValueParser {

    private ModbusValueParser() {
    }

    public static int registerWordCount(String dataType, int quantity) {
        int q = Math.max(1, quantity);
        return switch (dataType != null ? dataType : "INT16") {
            case "INT32", "UINT32", "FLOAT32" -> Math.max(2, q);
            default -> q;
        };
    }

    public static BigDecimal parse(
            String dataType,
            Register[] regs,
            boolean byteSwap,
            boolean wordSwap,
            BigDecimal scale,
            BigDecimal offset
    ) {
        if (regs == null || regs.length == 0) {
            return null;
        }
        String dt = dataType != null ? dataType : "INT16";
        BigDecimal raw = switch (dt) {
            case "INT16" -> BigDecimal.valueOf((short) (regs[0].getValue() & 0xFFFF));
            case "UINT16" -> BigDecimal.valueOf(regs[0].getValue() & 0xFFFFL);
            case "INT32", "UINT32", "FLOAT32" -> {
                if (regs.length < 2) {
                    yield null;
                }
                int w0 = regs[0].getValue() & 0xFFFF;
                int w1 = regs[1].getValue() & 0xFFFF;
                if (byteSwap) {
                    w0 = swapBytes16(w0);
                    w1 = swapBytes16(w1);
                }
                if (wordSwap) {
                    int t = w0;
                    w0 = w1;
                    w1 = t;
                }
                int combined = (w0 << 16) | w1;
                yield switch (dt) {
                    case "INT32" -> BigDecimal.valueOf(combined);
                    case "UINT32" -> BigDecimal.valueOf(combined & 0xFFFFFFFFL);
                    case "FLOAT32" -> BigDecimal.valueOf(Float.intBitsToFloat(combined));
                    default -> null;
                };
            }
            default -> BigDecimal.valueOf((short) (regs[0].getValue() & 0xFFFF));
        };
        if (raw == null) {
            return null;
        }
        BigDecimal s = scale != null ? scale : BigDecimal.ONE;
        BigDecimal o = offset != null ? offset : BigDecimal.ZERO;
        return raw.multiply(s).add(o).setScale(6, RoundingMode.HALF_UP);
    }

    private static int swapBytes16(int w) {
        return ((w & 0xFF) << 8) | ((w >> 8) & 0xFF);
    }

    public static Register[] toRegisters(InputRegister[] in) {
        if (in == null) {
            return new Register[0];
        }
        Register[] out = new Register[in.length];
        for (int i = 0; i < in.length; i++) {
            out[i] = new SimpleRegister(in[i].getValue());
        }
        return out;
    }
}
