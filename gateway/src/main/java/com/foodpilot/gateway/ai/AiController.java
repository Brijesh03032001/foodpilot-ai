package com.foodpilot.gateway.ai;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * Proxies the LLM-heavy endpoints to the Python AI microservice. The gateway
 * stays thin here on purpose: the LangChain chains and LangGraph agents live in
 * Python, and this controller just forwards + surfaces failures cleanly.
 */
@RestController
@RequestMapping("/api")
public class AiController {

    private final RestClient ai;

    public AiController(RestClient aiRestClient) {
        this.ai = aiRestClient;
    }

    @PostMapping("/parse")
    public Object parse(@RequestBody Map<String, Object> body) {
        return forward("/parse", body);
    }

    @PostMapping("/recommend")
    public Object recommend(@RequestBody Map<String, Object> body) {
        return forward("/recommend", body);
    }

    @PostMapping("/order/resolve")
    public Object orderResolve(@RequestBody Map<String, Object> body) {
        return forward("/order/resolve", body);
    }

    @PostMapping("/chat")
    public Object chat(@RequestBody Map<String, Object> body) {
        return forward("/chat", body);
    }

    @PostMapping("/copilot")
    public Object copilot(@RequestBody Map<String, Object> body) {
        return forward("/copilot", body);
    }

    @PostMapping("/reviews/report")
    public Object reviewsReport(@RequestBody Map<String, Object> body) {
        return forward("/reviews/report", body);
    }

    /** Full truck + menu for any truck (proxied from the Python catalog). */
    @GetMapping("/trucks/{id}")
    public Object truck(@PathVariable String id) {
        try {
            return ai.get().uri("/trucks/{id}", id).retrieve().body(Object.class);
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(
                    HttpStatusCode.valueOf(e.getStatusCode().value()),
                    e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service unreachable: " + e.getMessage());
        }
    }

    /** Health of the whole chain: gateway + downstream AI service. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("gateway", "up");
        try {
            out.put("ai", ai.get().uri("/health").retrieve().body(Object.class));
        } catch (Exception e) {
            out.put("ai", "down");
        }
        return out;
    }

    private Object forward(String path, Map<String, Object> body) {
        try {
            return ai.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Object.class);
        } catch (RestClientResponseException e) {
            // propagate the AI service's status + message
            throw new ResponseStatusException(
                    HttpStatusCode.valueOf(e.getStatusCode().value()),
                    e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service unreachable: " + e.getMessage());
        }
    }
}
