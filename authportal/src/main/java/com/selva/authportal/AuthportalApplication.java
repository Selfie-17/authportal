package com.selva.authportal;

import com.selva.authportal.config.BackblazeStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(BackblazeStorageProperties.class)
public class AuthportalApplication {

	public static void main(String[] args) {
		SpringApplication.run(AuthportalApplication.class, args);
	}

}
