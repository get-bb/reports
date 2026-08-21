# Deprecated helper, kept only so older links keep working.
# The repro scripts now read BB_SERVER_URL / BB_HOST_DAEMON_PORT from the
# environment. In your bb worktree run:
#   eval "$(scripts/bb-dev-app env)"
# and export the project id printed by the project-creation curl:
#   export BB_PROJECT_ID=proj_xxx
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
