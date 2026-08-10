package com.foodpilot.gateway.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * RestClient pointed at the Python AI service. Read timeout is generous
 * because the Owner Copilot and review report run a local reasoning model and
 * can take one to a few minutes.
 */
@Configuration
public class AiClientConfig {

    @Bean
    RestClient aiRestClient(@Value("${foodpilot.ai-service-url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofMinutes(6).toMillis());
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }
}
