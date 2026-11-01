package com.bookscoreideas.web;

import com.bookscoreideas.BooksCoreIdeasApplication;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

/**
 * SEC-03: the app has no login, so only this machine may reach it, and the H2 Console
 * (which can read and change every table) is a dev-only tool. The database itself must
 * not listen on the network either.
 *
 * Starts the real application on a real port, configured the way start-dev / start-prod
 * start it, except for an in-memory database. Not an IntegrationTest: that uses the test
 * profile, which turns the console off by itself, and MockMvc, which binds no socket.
 */
class NetworkExposureTest {

    @Test
    void devListensOnlyOnThisMachineAndKeepsTheConsole() throws Exception {
        try (ConfigurableApplicationContext app = start("dev")) {
            int port = portOf(app);

            assertReachableOnlyFromLoopback(port);
            assertThat(get(port, "/h2-console/").statusCode()).isEqualTo(200);
        }
    }

    @Test
    void prodListensOnlyOnThisMachineAndHasNoConsole() throws Exception {
        try (ConfigurableApplicationContext app = start("prod")) {
            int port = portOf(app);

            assertReachableOnlyFromLoopback(port);
            assertThat(get(port, "/h2-console/").statusCode()).isEqualTo(404);
        }
    }

    /** BE-09: dev tools are opt-in, so `java -jar` or an IDE run without a profile gets the safe setup. */
    @Test
    void withoutAProfileItListensOnlyOnThisMachineAndHasNoConsole() throws Exception {
        try (ConfigurableApplicationContext app = start()) {
            int port = portOf(app);

            assertReachableOnlyFromLoopback(port);
            assertThat(get(port, "/h2-console/").statusCode()).isEqualTo(404);
        }
    }

    /** Even combined with dev, prod (listed last, so it wins) has no console. */
    @Test
    void prodWinsOverDev() throws Exception {
        try (ConfigurableApplicationContext app = start("dev", "prod")) {
            assertThat(get(portOf(app), "/h2-console/").statusCode()).isEqualTo(404);
        }
    }

    @Test
    void theDatabaseOpensNoNetworkPort(@TempDir Path dir) throws Exception {
        Properties config = new Properties();
        try (InputStream in = getClass().getResourceAsStream("/application.properties")) {
            config.load(in);
        }
        String realUrl = config.getProperty("spring.datasource.url");
        String url = realUrl.replace("./data/booksdb", dir.toString().replace('\\', '/') + "/booksdb");
        assertThat(url).as("the real database URL, pointed at a temporary directory").isNotEqualTo(realUrl);

        try (Connection ignored = DriverManager.getConnection(url, "sa", "")) {
            // With AUTO_SERVER, H2 locks the database through this file and records its TCP
            // server here ("server=<LAN address>:<port>"; it listens on every adapter).
            // Without it, H2 locks the database file itself and writes no lock file.
            Path lockFile = dir.resolve("booksdb.lock.db");
            Properties lock = new Properties();
            if (Files.exists(lockFile)) {
                try (InputStream in = Files.newInputStream(lockFile)) {
                    lock.load(in);
                }
            }
            assertThat(lock.getProperty("server")).isNull();
        }
    }

    private static ConfigurableApplicationContext start(String... profiles) throws IOException {
        String images = Files.createTempDirectory("bci-exposure-images").toString();
        return new SpringApplicationBuilder(BooksCoreIdeasApplication.class)
                .profiles(profiles)
                .run("--server.port=0",
                        "--spring.datasource.url=jdbc:h2:mem:bci-exposure-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
                        "--app.upload.dir=" + images);
    }

    private static int portOf(ConfigurableApplicationContext app) {
        return ((ServletWebServerApplicationContext) app).getWebServer().getPort();
    }

    private static void assertReachableOnlyFromLoopback(int port) throws IOException {
        try (Socket socket = connect(InetAddress.getLoopbackAddress(), port)) {
            assertThat(socket.isConnected()).isTrue();
        }

        List<InetAddress> networkAddresses = networkAddresses();
        assumeFalse(networkAddresses.isEmpty(), "this machine has no network address to try");
        for (InetAddress address : networkAddresses) {
            assertThatThrownBy(() -> connect(address, port).close())
                    .as("connecting via %s", address.getHostAddress())
                    .isInstanceOf(IOException.class);
        }
    }

    private static Socket connect(InetAddress address, int port) throws IOException {
        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(address, port), 5000);
            return socket;
        } catch (IOException e) {
            socket.close();
            throw e;
        }
    }

    /** This machine's own IPv4 addresses on its network adapters (what others on the network would use). */
    private static List<InetAddress> networkAddresses() throws IOException {
        List<InetAddress> result = new ArrayList<>();
        for (NetworkInterface nic : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            if (!nic.isUp() || nic.isLoopback()) continue;
            for (InetAddress address : Collections.list(nic.getInetAddresses())) {
                if (address instanceof Inet4Address && !address.isLinkLocalAddress()) result.add(address);
            }
        }
        return result;
    }

    private static HttpResponse<String> get(int port, String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}
