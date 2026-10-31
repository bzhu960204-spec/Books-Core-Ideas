package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * The frontend cancels reads it no longer needs (FE-03: leaving a page, React StrictMode
 * in dev). When that happens while a response is being written, the servlet container
 * reports the closed connection; that is not a server error and must not be logged as one.
 */
@ExtendWith(OutputCaptureExtension.class)
@Import(ClientAbortTest.AbortingController.class)
class ClientAbortTest extends IntegrationTest {

    @RestController
    @TestConfiguration
    static class AbortingController {
        @GetMapping("/test/client-abort")
        String abort() throws AsyncRequestNotUsableException {
            throw new AsyncRequestNotUsableException("ServletOutputStream failed to write: connection aborted");
        }
    }

    @Test
    void aClientThatWentAwayIsNotAnUnhandledError(CapturedOutput output) throws Exception {
        int status = mockMvc.perform(get("/test/client-abort")).andReturn().getResponse().getStatus();

        assertThat(status).isNotEqualTo(500);
        assertThat(output.getOut()).doesNotContain("Unhandled exception");
    }
}
