package com.foodpilot.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * FoodPilot API gateway.
 *
 * <p>The single entry point the Next.js frontend talks to. It owns the sales
 * domain directly (SQL over the SQLite orders DB via JDBC) and proxies every
 * LLM-heavy call to the Python AI microservice. Classic gateway / BFF
 * microservice split: Java for transactional data, Python for the ML brain.
 */
@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
