package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.DataPolicyResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.DataPolicyUpdateRequest;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.policy.SystemDataPolicyEntity;
import com.example.miniscada.domain.policy.SystemDataPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class DataPolicyService {

    private final SystemDataPolicyRepository policyRepository;

    @Transactional(readOnly = true)
    public DataPolicyResponse get() {
        SystemDataPolicyEntity p = policyRepository.findById(1)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, "Policy not found"));
        return new DataPolicyResponse(
                p.getRawRetentionDays(),
                p.getAggregateRetentionDays(),
                p.getDownsamplingInterval()
        );
    }

    @Transactional
    public DataPolicyResponse patch(DataPolicyUpdateRequest req) {
        SystemDataPolicyEntity p = policyRepository.findById(1)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, "Policy not found"));
        if (req.rawRetentionDays() != null) {
            p.setRawRetentionDays(req.rawRetentionDays());
        }
        if (req.aggregateRetentionDays() != null) {
            p.setAggregateRetentionDays(req.aggregateRetentionDays());
        }
        if (req.downsamplingInterval() != null) {
            p.setDownsamplingInterval(req.downsamplingInterval());
        }
        validate(p);
        p.setUpdatedAt(Instant.now());
        policyRepository.save(p);
        return get();
    }

    @Transactional
    public DataPolicyResponse reset() {
        SystemDataPolicyEntity p = policyRepository.findById(1)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, "Policy not found"));
        p.setRawRetentionDays(7);
        p.setAggregateRetentionDays(365);
        p.setDownsamplingInterval("10m");
        p.setUpdatedAt(Instant.now());
        policyRepository.save(p);
        return get();
    }

    private static void validate(SystemDataPolicyEntity p) {
        if (p.getRawRetentionDays() < 1 || p.getAggregateRetentionDays() < 1) {
            throw BusinessException.badRequest(ErrorCode.INVALID_POLICY, "Retention days must be >= 1");
        }
        if (p.getAggregateRetentionDays() < p.getRawRetentionDays()) {
            throw BusinessException.badRequest(ErrorCode.INVALID_POLICY, "aggregate_retention_days must be >= raw_retention_days");
        }
    }
}
