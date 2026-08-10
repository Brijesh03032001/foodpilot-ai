package com.foodpilot.gateway.sales;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Owns the sales domain. Reads the SQLite orders database directly with JDBC —
 * the same completed-orders numbers the Python sales_stats tool computes, but
 * served straight from Java so the gateway doesn't need the AI service for
 * plain analytics.
 */
@Service
public class SalesService {

    private final JdbcTemplate jdbc;

    public SalesService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Resolve a truck id OR loose name to its id, or null when not given. */
    public String resolveTruckId(String truck) {
        if (truck == null || truck.isBlank()) {
            return null;
        }
        List<String> byId = jdbc.query(
                "SELECT id FROM trucks WHERE id = ?",
                (rs, i) -> rs.getString("id"), truck);
        if (!byId.isEmpty()) {
            return byId.get(0);
        }
        List<String> byName = jdbc.query(
                "SELECT id FROM trucks WHERE lower(name) LIKE ?",
                (rs, i) -> rs.getString("id"), "%" + truck.toLowerCase() + "%");
        return byName.isEmpty() ? null : byName.get(0);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /** Full dashboard summary for a scope: headline + top items + by-day. */
    public Map<String, Object> summary(String truckId, int topLimit) {
        String where = "status = 'completed'" + (truckId != null ? " AND truck_id = ?" : "");
        Object[] p = truckId != null ? new Object[]{truckId} : new Object[]{};

        Map<String, Object> head = jdbc.queryForMap(
                "SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue, "
                        + "COALESCE(AVG(total),0) AS aov FROM orders WHERE " + where, p);

        long orders = ((Number) head.get("orders")).longValue();
        double revenue = round2(((Number) head.get("revenue")).doubleValue());
        double aov = round2(((Number) head.get("aov")).doubleValue());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("truckId", truckId);
        out.put("revenue", revenue);
        out.put("orders", orders);
        out.put("aov", aov);
        out.put("top_items", topItems(truckId, topLimit));
        out.put("sales_by_day", salesByDay(truckId));
        return out;
    }

    public List<Map<String, Object>> topItems(String truckId, int limit) {
        String where = "o.status = 'completed'" + (truckId != null ? " AND o.truck_id = ?" : "");
        List<Object> params = new ArrayList<>();
        if (truckId != null) {
            params.add(truckId);
        }
        params.add(Math.max(1, Math.min(limit, 50)));
        String sql = "SELECT mi.name AS name, SUM(oi.quantity) AS qty, "
                + "COALESCE(SUM(oi.line_total),0) AS revenue "
                + "FROM order_items oi "
                + "JOIN orders o ON oi.order_id = o.id "
                + "JOIN menu_items mi ON oi.menu_item_id = mi.id "
                + "WHERE " + where + " GROUP BY mi.name ORDER BY qty DESC LIMIT ?";
        List<Map<String, Object>> rows = jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", rs.getString("name"));
            m.put("qty", rs.getLong("qty"));
            m.put("revenue", round2(rs.getDouble("revenue")));
            return m;
        }, params.toArray());
        return rows;
    }

    public List<Map<String, Object>> salesByDay(String truckId) {
        String where = "status = 'completed'" + (truckId != null ? " AND truck_id = ?" : "");
        Object[] p = truckId != null ? new Object[]{truckId} : new Object[]{};
        String sql = "SELECT date(created_at) AS date, COALESCE(SUM(total),0) AS revenue, "
                + "COUNT(*) AS orders FROM orders WHERE " + where
                + " GROUP BY date(created_at) ORDER BY date";
        return jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", rs.getString("date"));
            m.put("revenue", round2(rs.getDouble("revenue")));
            m.put("orders", rs.getLong("orders"));
            return m;
        }, p);
    }
}
