package com.example.miniscada.polling;

import com.example.miniscada.domain.tag.DeviceTagEntity;

import java.math.BigDecimal;

public record TagPollSample(
        DeviceTagEntity tag,
        BigDecimal value,
        String alarmState,
        String quality
) {
}
