package com.example.miniscada.polling;

public final class SwapEncoding {

    private SwapEncoding() {
    }

    public static boolean[] decode(String byteOrder) {
        boolean bs = false;
        boolean ws = false;
        if (byteOrder != null && byteOrder.startsWith("BYTE:")) {
            String[] p = byteOrder.split(";");
            for (String x : p) {
                if (x.startsWith("BYTE:")) {
                    bs = Boolean.parseBoolean(x.substring(5));
                }
                if (x.startsWith("WORD:")) {
                    ws = Boolean.parseBoolean(x.substring(5));
                }
            }
        }
        return new boolean[]{bs, ws};
    }
}
