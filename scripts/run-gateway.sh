#!/usr/bin/env bash
# FoodPilot API gateway (Java / Spring Boot) — owns SQL sales, proxies the AI
# service. Serves on :8080. Needs Java 17+ (Spring Boot 3).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pick a Java 17+ home (Spring Boot 3 won't run on Java 8).
if [ -z "${JAVA_HOME:-}" ] || ! "${JAVA_HOME}/bin/java" -version 2>&1 | grep -qE '"(1[7-9]|2[0-9])'; then
  for cand in \
    /opt/homebrew/opt/openjdk@21 \
    /opt/homebrew/opt/openjdk@23 \
    /opt/homebrew/opt/openjdk; do
    if [ -x "$cand/bin/java" ]; then JAVA_HOME="$cand"; break; fi
  done
fi
export JAVA_HOME
echo "Using JAVA_HOME=$JAVA_HOME"

export FOODPILOT_DB="${FOODPILOT_DB:-$ROOT/foodpilot.db}"
exec mvn -f "$ROOT/gateway/pom.xml" -DskipTests spring-boot:run
