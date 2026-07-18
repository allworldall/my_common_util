package com.example.my_common_util;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MyCommonUtilApplication {

	public static void main(String[] args) {
		SpringApplication.run(MyCommonUtilApplication.class, args);
	}

}
