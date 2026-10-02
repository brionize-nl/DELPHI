#!/bin/sh
# Git obtains credentials without putting the PAT in arguments or remote URLs.
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) cat "$DELPHI_GITHUB_KEY_FILE" ;;
  *) exit 1 ;;
esac
