package com.lifelink.allocation;

import com.lifelink.inventory.dto.InventoryDtos.View;
import java.util.List;

public record AllocationCandidate(View unit, boolean eligible, List<String> rejectionReasons, int rank) {
}
