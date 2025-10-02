Feature: Producer-Consumer Integration
  As a monitoring system
  I want to verify that producer and consumer services work together
  So that IDP health checks are properly distributed and processed

  Background:
    Given I am in this directory

  Scenario: Services start and communicate successfully
    When I run compose "up --detach --build --wait"
    Then I run compose "ps --format json rabbitmq" and the service should be "healthy"
    And I run compose "ps --format json producer" and the service should be "running"
    And I run compose "ps --format json consumer" and the service should be "running"
    And I run compose "logs consumer" and it should contain "Consumer started successfully!"
    And I run compose "down --volumes"
