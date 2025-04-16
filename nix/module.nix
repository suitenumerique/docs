{
  config,
  lib,
  pkgs,
  ...
}:
let
  inherit (lib)
    getExe
    mkDefault
    mkEnableOption
    mkIf
    mkPackageOption
    mkOption
    types
    optionalAttrs
    optional
    optionalString
    ;

  cfg = config.services.docs;

  gunicornSettings = pkgs.writeText "gunicorn-settings.py" ''
    bind = [ "${cfg.listenAddress}:${toString cfg.port}" ]
    name = "impress"
    python_path = "${cfg.package}/lib/docs/src/"

    graceful_timeout = 90
    timeout = 90
    workers = 3

    accesslog = "-"
    errorlog = "-"
    loglevel = "debug"
  '';

  commonServiceConfig = {
    RuntimeDirectory = "docs";
    StateDirectory = "docs";
    WorkingDirectory = "/var/lib/docs";

    User = "docs";
    DynamicUser = true;
    SupplementaryGroups = mkIf cfg.redis.createLocally [ "redis-docs" ];
    # hardening
    AmbientCapabilities = "";
    CapabilityBoundingSet = [ "" ];
    DevicePolicy = "closed";
    LockPersonality = true;
    # MemoryDenyWriteExecute = true;
    NoNewPrivileges = true;
    PrivateDevices = true;
    PrivateTmp = true;
    PrivateUsers = true;
    ProcSubset = "pid";
    ProtectClock = true;
    ProtectControlGroups = true;
    ProtectHome = true;
    ProtectHostname = true;
    ProtectKernelLogs = true;
    ProtectKernelModules = true;
    ProtectKernelTunables = true;
    ProtectProc = "invisible";
    ProtectSystem = "strict";
    RemoveIPC = true;
    RestrictAddressFamilies = [ "AF_INET AF_INET6 AF_UNIX" ];
    RestrictNamespaces = true;
    RestrictRealtime = true;
    RestrictSUIDSGID = true;
    SystemCallArchitectures = "native";
    UMask = "0077";
  };

  pythonPreloadSecrets = ''
    ${
      if cfg.secretKeyPath != null then
        "export DJANGO_SECRET_KEY=$(cat ${cfg.secretKeyPath})"
      else
        ''
          if [[ ! -f /var/lib/docs/django_secret_key ]]; then
            (
              umask 0377
              tr -dc A-Za-z0-9 < /dev/urandom | head -c64 | ${pkgs.moreutils}/bin/sponge /var/lib/docs/django_secret_key
            )
          fi
          export DJANGO_SECRET_KEY=$(cat /var/lib/docs/django_secret_key)
        ''
    }
    ${optionalString (
      cfg.s3.accessKeyIDPath != null
    ) "export AWS_S3_ACCESS_KEY_ID=$(cat ${cfg.s3.accessKeyIDPath})"}
    ${optionalString (
      cfg.s3.secretAccessKeyPath != null
    ) "export AWS_S3_SECRET_ACCESS_KEY=$(cat ${cfg.s3.secretAccessKeyPath})"}
    ${optionalString (
      cfg.oidc.clientSecretPath != null
    ) "export OIDC_RP_CLIENT_SECRET=$(cat ${cfg.oidc.clientSecretPath})"}
    ${optionalString (
      cfg.collaborationServer.serverSecretPath != null
    ) "export COLLABORATION_SERVER_SECRET=$(cat ${cfg.collaborationServer.serverSecretPath})"}
    ${optionalString (
      cfg.collaborationServer.yproviderApiKeyPath != null
    ) "export Y_PROVIDER_API_KEY=$(cat ${cfg.collaborationServer.yproviderApiKeyPath})"}
  '';
in
{
  options.services.docs = {
    enable = mkEnableOption "Docs";

    package = mkPackageOption pkgs "docs-backend" { };

    frontendPackage = mkPackageOption pkgs "docs-frontend" { };

    listenAddress = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = ''
        Address used by gunicorn to listen to.
      '';
    };

    port = mkOption {
      type = types.port;
      default = 8000;
      description = ''
        Port used by gunicorn to listen to.
      '';
    };

    enableNginx = mkOption {
      type = types.bool;
      default = true;
      description = ''
        Enable Nginx as a proxy server.
      '';
    };

    secretKeyPath = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to the Django secret key.
      '';
    };

    s3 = {
      url = mkOption {
        type = types.str;
        description = ''
          URL of the s3 bucket.
        '';
      };

      accessKeyIDPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the access key ID of the bucket.
        '';
      };

      secretAccessKeyPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the secret access key of the bucket.
        '';
      };
    };

    oidc = {
      clientSecretPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the client secret of the client of OIDC.
        '';
      };
    };

    database = {
      createLocally = mkOption {
        type = types.bool;
        default = false;
        description = ''
          Configure local PostgreSQL database server for docs.
        '';
      };
    };

    redis = {
      createLocally = mkOption {
        type = types.bool;
        default = false;
        description = ''
          Configure local Redis cache server for docs.
        '';
      };
    };

    collaborationServer = {
      package = mkPackageOption pkgs "docs-collaboration-server" { };

      port = mkOption {
        type = types.port;
        default = 4444;
        description = ''
          Port used by the collaboration server to listen.
        '';
      };

      serverSecretPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the server secret of the collaboration server.
        '';
      };

      yproviderApiKeyPath = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = ''
          Path to the y-provider API key.
        '';
      };

      config = mkOption {
        type = types.attrsOf (
          types.oneOf [
            types.str
            types.bool
          ]
        );
        default = { };
        example = ''
          {
            COLLABORATION_LOGGING = true;
          }
        '';
        description = ''
          Configuration options of collaboration server.

          See https://github.com/suitenumerique/docs/blob/v3.1.0/docs/env.md
        '';
      };
    };

    domain = mkOption {
      type = types.str;
      description = ''
        Domain name of the docs instance.
      '';
    };

    config = mkOption {
      type = types.attrsOf (
        types.oneOf [
          types.str
          types.bool
        ]
      );
      default = { };
      example = ''
        {
          DJANGO_ALLOWED_HOSTS = "*";
        }
      '';
      description = ''
        Configuration options of docs.

        See https://github.com/suitenumerique/docs/blob/v3.1.0/docs/env.md
      '';
    };

    environmentFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to environment file.

        This can be useful to pass secrets to docs via tools like `agenix` or `sops`.
      '';
    };
  };

  config = mkIf cfg.enable {
    services.docs.config =
      {
        DJANGO_CONFIGURATION = mkDefault "Production";
        DJANGO_SETTINGS_MODULE = mkDefault "impress.settings";
        DATA_DIR = mkDefault "/var/lib/docs";
      }
      // (optionalAttrs cfg.enableNginx {
        DJANGO_ALLOWED_HOSTS = mkDefault "localhost,127.0.0.1,${cfg.domain}";
      })
      // (optionalAttrs cfg.database.createLocally {
        DB_NAME = mkDefault "docs";
        DB_USER = mkDefault "docs";
        DB_HOST = mkDefault "/run/postgresql";
      })
      // (optionalAttrs cfg.redis.createLocally {
        REDIS_URL = mkDefault "unix://${config.services.redis.servers.docs.unixSocket}?db=1";
        CELERY_BROKER_URL = mkDefault "redis+socket://${config.services.redis.servers.docs.unixSocket}?db=2";
      });

    systemd.services.docs = {
      description = "Docs from SuiteNumérique";
      after =
        [ "network.target" ]
        ++ (optional cfg.database.createLocally "postgresql.service")
        ++ (optional cfg.redis.createLocally "redis-docs.service");
      wants =
        (optional cfg.database.createLocally "postgresql.service")
        ++ (optional cfg.redis.createLocally "redis-docs.service");
      wantedBy = [ "multi-user.target" ];

      preStart = ''
        ln -sf ${cfg.package}/lib/docs/static /var/lib/docs/

        if [ ! -f .version ]; then 
          touch .version
        fi

        if [ "${cfg.package.version}" != "$(cat .version)" ]; then 
          ${getExe cfg.package} migrate && echo -n "${cfg.package.version}" > .version 
        fi
      '';

      script = ''
        ${pythonPreloadSecrets}

        ${cfg.package}/bin/gunicorn -c ${gunicornSettings} impress.wsgi:application
      '';

      environment = cfg.config;

      serviceConfig = {
        EnvironmentFile = optional (cfg.environmentFile != null) cfg.environmentFile;
      } // commonServiceConfig;
    };

    systemd.services.docs-celery = {
      description = "Docs Celery broker from SuiteNumérique";
      after =
        [ "network.target" ]
        ++ (optional cfg.database.createLocally "postgresql.service")
        ++ (optional cfg.redis.createLocally "redis-docs.service");
      wants =
        (optional cfg.database.createLocally "postgresql.service")
        ++ (optional cfg.redis.createLocally "redis-docs.service");
      wantedBy = [ "multi-user.target" ];

      script = ''
        ${pythonPreloadSecrets}

        ${cfg.package}/bin/celery -A impress.celery_app worker
      '';

      environment = cfg.config;

      serviceConfig =
        (optionalAttrs (cfg.environmentFile != null) { EnvironmentFile = cfg.environmentFile; })
        // commonServiceConfig;
    };

    systemd.services.docs-collaboration-server = {
      description = "Docs Collaboration Server from SuiteNumérique";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      script = ''
        ${optionalString (
          cfg.collaborationServer.serverSecretPath != null
        ) "export COLLABORATION_SERVER_SECRET=$(cat ${cfg.collaborationServer.serverSecretPath})"}
        ${optionalString (
          cfg.collaborationServer.yproviderApiKeyPath != null
        ) "export Y_PROVIDER_API_KEY=$(cat ${cfg.collaborationServer.yproviderApiKeyPath})"}

        ${cfg.collaborationServer.package}/bin/docs-collaboration-server
      '';

      environment = {
        PORT = toString cfg.collaborationServer.port;
        COLLABORATION_BACKEND_BASE_URL = "https://${cfg.domain}";
      } // cfg.collaborationServer.config;

      serviceConfig = commonServiceConfig;
    };

    services.postgresql = mkIf cfg.database.createLocally {
      enable = true;
      ensureDatabases = [ "docs" ];
      ensureUsers = [
        {
          name = "docs";
          ensureDBOwnership = true;
        }
      ];
    };

    services.redis.servers.docs = mkIf cfg.redis.createLocally { enable = true; };

    services.nginx = mkIf cfg.enableNginx {
      enable = true;

      virtualHosts.${cfg.domain} = {
        extraConfig = ''
          error_page 401 /401;
          error_page 403 /403;
          error_page 404 /404;
        '';

        root = cfg.frontendPackage;

        locations."/docs/" = {
          extraConfig = ''
            error_page 404 /docs/[id]/;
          '';
        };

        locations."/api" = {
          proxyPass = "http://localhost:${toString cfg.port}";
          recommendedProxySettings = true;
        };

        locations."/admin" = {
          proxyPass = "http://localhost:${toString cfg.port}";
          recommendedProxySettings = true;
        };

        locations."/collaboration/ws/" = {
          proxyPass = "http://localhost:${toString cfg.collaborationServer.port}";
          recommendedProxySettings = true;
          proxyWebsockets = true;
        };

        locations."/collaboration/api/" = {
          proxyPass = "http://localhost:${toString cfg.collaborationServer.port}";
          recommendedProxySettings = true;
        };

        locations."/media-auth" = {
          proxyPass = "http://localhost:${toString cfg.port}/api/v1.0/documents/media-auth/";
          recommendedProxySettings = true;
          extraConfig = ''
            proxy_set_header X-Original-URL $request_uri;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-Method $request_method;
          '';
        };

        locations."/media/" = {
          proxyPass = cfg.s3.url;
          recommendedProxySettings = true;
          extraConfig = ''
            auth_request /media-auth;
            auth_request_set $authHeader $upstream_http_authorization;
            auth_request_set $authDate $upstream_http_x_amz_date;
            auth_request_set $authContentSha256 $upstream_http_x_amz_content_sha256;

            proxy_set_header Authorization $authHeader;
            proxy_set_header X-Amz-Date $authDate;
            proxy_set_header X-Amz-Content-SHA256 $authContentSha256;

            add_header Content-Security-Policy "default-src 'none'" always;
          '';
        };
      };
    };
  };
}
