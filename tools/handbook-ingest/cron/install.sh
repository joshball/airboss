#!/usr/bin/env bash
#
# Install the airboss errata-discovery launchd agent.
#
# Renders `com.airboss.discover-errata.plist.template` against the current
# repo path and a log directory, then loads the agent. Idempotent: re-running
# replaces any existing plist + log paths.
#
# Schedule: Sundays at 09:00 local time. The cron is gated by the same
# 7-day freshness check the dispatcher uses, so a Sunday run that landed in
# the dev-server hook earlier in the week is a free no-op.
#
# Usage:
#   ./tools/handbook-ingest/cron/install.sh
#   ./tools/handbook-ingest/cron/install.sh --uninstall
#
# Future: hangar UI offers a one-click "install/uninstall cron" toggle.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/com.airboss.discover-errata.plist.template"
LABEL="com.airboss.discover-errata"

LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
PLIST_DEST="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/airboss"

uninstall() {
	if launchctl list | grep -q "${LABEL}"; then
		echo "Unloading ${LABEL}..."
		launchctl unload "${PLIST_DEST}" 2>/dev/null || true
	fi
	if [[ -f "${PLIST_DEST}" ]]; then
		echo "Removing ${PLIST_DEST}..."
		rm -f "${PLIST_DEST}"
	fi
	echo "Discovery cron uninstalled."
}

if [[ "${1:-}" == "--uninstall" ]]; then
	uninstall
	exit 0
fi

if [[ ! -f "${TEMPLATE}" ]]; then
	echo "error: template missing at ${TEMPLATE}" >&2
	exit 1
fi

mkdir -p "${LAUNCH_AGENTS_DIR}" "${LOG_DIR}"

# Replace placeholders. `sed` is portable enough for this small render.
TMP="$(mktemp -t com.airboss.discover-errata.plist.XXXXXX)"
trap 'rm -f "${TMP}"' EXIT

sed \
	-e "s|__REPO_ROOT__|${REPO_ROOT}|g" \
	-e "s|__LOG_DIR__|${LOG_DIR}|g" \
	"${TEMPLATE}" >"${TMP}"

# Replace any prior install (idempotent re-runs).
if launchctl list | grep -q "${LABEL}"; then
	launchctl unload "${PLIST_DEST}" 2>/dev/null || true
fi

mv -f "${TMP}" "${PLIST_DEST}"
trap - EXIT

launchctl load "${PLIST_DEST}"

echo "Installed ${PLIST_DEST}."
echo "Schedule: Sundays at 09:00 local."
echo "Logs:     ${LOG_DIR}/com.airboss.discover-errata.{log,err}"
echo "Verify:   launchctl list | grep ${LABEL}"
echo "Uninstall: $0 --uninstall"
