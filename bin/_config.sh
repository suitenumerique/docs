#!/usr/bin/env bash

set -eo pipefail

REPO_DIR="$(cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd)"
UNSET_USER=0

TERRAFORM_DIRECTORY="./env.d/terraform"
COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
COMPOSE_PROJECT="docs"


# _set_user: set (or unset) default user id used to run docker commands
#
# usage: _set_user
#
# You can override default user ID (the current host user ID), by defining the
# USER_ID environment variable.
#
# To avoid running docker commands with a custom user, please set the
# $UNSET_USER environment variable to 1.
function _set_user() {

    if [ $UNSET_USER -eq 1 ]; then
        USER_ID=""
        return
    fi

    # USER_ID = USER_ID or `id -u` if USER_ID is not set
    USER_ID=${USER_ID:-$(id -u)}

    echo "🙋(user) ID: ${USER_ID}"
}

# docker_compose: wrap docker compose command
#
# usage: docker_compose [options] [ARGS...]
#
# options: docker compose command options
# ARGS   : docker compose command arguments
function _docker_compose() {

    echo "🐳(compose) project: '${COMPOSE_PROJECT}' file: '${COMPOSE_FILE}'"
    docker compose \
        -p "${COMPOSE_PROJECT}" \
        -f "${COMPOSE_FILE}" \
        --project-directory "${REPO_DIR}" \
        "$@"
}

# _dc_run: wrap docker compose run command
#
# usage: _dc_run [options] [ARGS...]
#
# options: docker compose run command options
# ARGS   : docker compose run command arguments
function _dc_run() {
    _set_user

    user_args="--user=$USER_ID"
    if [ -z $USER_ID ]; then
        user_args=""
    fi

    _docker_compose run --rm $user_args "$@"
}

# _dc_exec: wrap docker compose exec command
#
# usage: _dc_exec [options] [ARGS...]
#
# options: docker compose exec command options
# ARGS   : docker compose exec command arguments
function _dc_exec() {
    _set_user

    echo "🐳(compose) exec command: '\$@'"

    user_args="--user=$USER_ID"
    if [ -z $USER_ID ]; then
        user_args=""
    fi

    _docker_compose exec $user_args "$@"
}

# _django_manage: wrap django's manage.py command with docker compose
#
# usage : _django_manage [ARGS...]
#
# ARGS : django's manage.py command arguments
function _django_manage() {
    _dc_run "app-dev" python manage.py "$@"
}

# _set_openstack_project: select an OpenStack project from the openrc files defined in the
# terraform directory.
#
# usage: _set_openstack_project
#
# If necessary the script will prompt the user to choose a project from those available
function _set_openstack_project() {

    declare prompt
    declare -a projects
    declare -i default=1
    declare -i choice=0
    declare -i n_projects

    # List projects by looking in the "./env.d/terraform" directory
    # and store them in an array
    read -r -a projects <<< "$(
        find "${TERRAFORM_DIRECTORY}" -maxdepth 1 -mindepth 1 -type d |
        sed 's|'"${TERRAFORM_DIRECTORY}\/"'||' |
        xargs
    )"
    nb_projects=${#projects[@]}

    if [[ ${nb_projects} -le 0 ]]; then
        echo "There are no OpenStack projects defined..." >&2
        echo "To add one, create a subdirectory in \"${TERRAFORM_DIRECTORY}\" with the name" \
            "of your project and copy your \"openrc.sh\" file into it." >&2
        exit 10
    fi

    if [[ ${nb_projects} -gt 1 ]]; then
        prompt="Select an OpenStack project to target:\\n"
        for (( i=0; i<nb_projects; i++ )); do
            prompt+="[$((i+1))] ${projects[$i]}"
            if [[ $((i+1)) -eq ${default} ]]; then
                prompt+=" (default)"
            fi
            prompt+="\\n"
        done
        prompt+="If your OpenStack project is not listed, add it to the \"env.d/terraform\" directory.\\n"
        prompt+="Your choice: "
        read -r -p "$(echo -e "${prompt}")" choice

        if [[ ${choice} -gt nb_projects ]]; then
            (>&2 echo "Invalid choice ${choice} (should be <= ${nb_projects})")
            exit 11
        fi

        if [[ ${choice} -le 0 ]]; then
            choice=${default}
        fi
    fi

    project=${projects[$((choice-1))]}
    # Check that the openrc.sh file exists for this project
    if [ ! -f "${TERRAFORM_DIRECTORY}/${project}/openrc.sh" ]; then
        (>&2 echo "Missing \"openrc.sh\" file in \"${TERRAFORM_DIRECTORY}/${project}\". Check documentation.")
        exit 12
    fi

    echo "${project}"
}
