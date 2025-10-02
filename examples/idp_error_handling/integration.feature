Feature: IDP Error Handling
  As a monitoring system
  I want to handle various IDP error scenarios gracefully
  So that failures are properly logged and don't crash the system

  Background:
    Given I am in this directory

  Scenario: System starts up successfully
    When I run compose "up --detach --build --wait"
    Then I run compose "ps --format json rabbitmq" and the service should be "healthy"
    And I run compose "ps --format json mock-idp" and the service should be "healthy"
    And I run compose "ps --format json producer" and the service should be "running"
    And I run compose "ps --format json consumer" and the service should be "running"
    And I run compose "logs consumer" and it should contain "Consumer started successfully!"
