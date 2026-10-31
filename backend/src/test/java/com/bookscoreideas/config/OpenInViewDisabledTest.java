package com.bookscoreideas.config;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.orm.jpa.support.OpenEntityManagerInViewInterceptor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Open-session-in-view stays off (BE-01): services load everything inside their
 * transactions, so every other integration test also proves no endpoint relies
 * on lazy loading while the response is written.
 */
class OpenInViewDisabledTest extends IntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void noOpenEntityManagerInViewInterceptor() {
        assertThat(context.getBeansOfType(OpenEntityManagerInViewInterceptor.class)).isEmpty();
    }
}
