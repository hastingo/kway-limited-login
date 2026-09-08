# Cartrack Fleet API Research

Official sources reviewed on 8 September 2026:

1. Authentication: https://developer.cartrack.com/docs/fleet-api-general/authentication/
2. Fleet API overview: https://developer.cartrack.com/docs/fleet-api/fleet-api/
3. Official OpenAPI specification: https://developer.cartrack.com/openapi/openapi.yaml
4. Use cases: https://developer.cartrack.com/docs/fleet-api-general/use-cases/
5. Vehicle endpoints: https://developer.cartrack.com/docs/fleet-api/vehicle/

## Confirmed integration details

Cartrack uses HTTPS with HTTP Basic Authentication. Fleetweb administrators must generate a dedicated Administrator API password or, preferably, a least-privilege User API password in Fleetweb under Settings → API Settings. A normal Fleetweb login password is not necessarily an API password.

The official Tanzania API base URL in the OpenAPI specification is `https://fleetapi-tz.cartrack.com/rest`.

The API provides `GET /vehicles`, `GET /vehicles/status`, `GET /trips`, `GET /trips/{registration}`, and `GET /vehicles/{registration}/odometer`. Trip queries accept `start_timestamp` and `end_timestamp`, have a maximum 31-day window, and return registration, trip start/end timestamps and locations, start/end odometer values, and `trip_distance` in meters. The odometer endpoint returns period start/end odometer readings and `distance` in meters and is recommended by Cartrack for accurate period distance. The trip APIs retain approximately five years of history.

K-Way can match its registered truck number to Cartrack's vehicle registration, query the trip loading-to-return window, store the distance in kilometers, and calculate liters per 100 km from portal fuel expenses. Active trips can use the current time as the query end; ended trips use the container-return date.
