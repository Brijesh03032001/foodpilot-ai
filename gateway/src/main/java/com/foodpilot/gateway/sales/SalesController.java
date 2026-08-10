package com.foodpilot.gateway.sales;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Sales analytics — served from Java (JDBC), no AI service needed. */
@RestController
@RequestMapping("/api/sales")
public class SalesController {

    private final SalesService sales;

    public SalesController(SalesService sales) {
        this.sales = sales;
    }

    /** One-shot dashboard summary for a scope (truck name/id, or all). */
    @GetMapping("/summary")
    public Map<String, Object> summary(
            @RequestParam(required = false) String truck,
            @RequestParam(defaultValue = "6") int limit) {
        String truckId = resolve(truck);
        return sales.summary(truckId, limit);
    }

    /** Single metric, mirroring the Python sales_stats tool. */
    @GetMapping
    public ResponseEntity<?> metric(
            @RequestParam String metric,
            @RequestParam(required = false) String truck,
            @RequestParam(defaultValue = "6") int limit) {
        String truckId = resolve(truck);
        Object rows = switch (metric.toLowerCase()) {
            case "top_items" -> sales.topItems(truckId, limit);
            case "sales_by_day" -> sales.salesByDay(truckId);
            case "revenue", "order_count", "avg_order_value" ->
                    sales.summary(truckId, limit);
            default -> null;
        };
        if (rows == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unknown metric '" + metric + "'",
                    "allowed", new String[]{"revenue", "order_count",
                            "avg_order_value", "top_items", "sales_by_day"}));
        }
        return ResponseEntity.ok(Map.of("metric", metric, "truckId", truckId, "rows", rows));
    }

    private String resolve(String truck) {
        if (truck == null || truck.isBlank() || "all".equalsIgnoreCase(truck)) {
            return null;
        }
        String id = sales.resolveTruckId(truck);
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "no truck matching '" + truck + "'");
        }
        return id;
    }
}
