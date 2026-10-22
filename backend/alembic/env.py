import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import os
from tests.safety_guard import validate_alembic_target_url, TestDatabaseSecurityError

# Determine target URL: CLI argument (-x db=... or -x url=...) > MIGRATION_DATABASE_URL > TEST_DATABASE_URL > settings.sync_database_url
x_args = context.get_x_argument(as_dictionary=True)
x_db = x_args.get("db")
x_url = x_args.get("url")

# Detect conflicting CLI arguments
if x_db and x_url and x_db.strip() != x_url.strip():
    raise TestDatabaseSecurityError(
        "Conflicting CLI migration target arguments: both -x db and -x url were provided with different values."
    )

cli_target = x_db or x_url

# Detect ambiguous environment configuration when no CLI target is given
mig_env = os.environ.get("MIGRATION_DATABASE_URL")
test_env = os.environ.get("TEST_DATABASE_URL")
if not cli_target and mig_env and test_env and mig_env.strip() != test_env.strip():
    raise TestDatabaseSecurityError(
        "Ambiguous migration target: both MIGRATION_DATABASE_URL and TEST_DATABASE_URL are configured "
        "with different targets. Disambiguate by specifying target explicitly via CLI argument (-x db=...)."
    )

raw_target = cli_target or mig_env or test_env or settings.sync_database_url

# Enforce fail-closed safety guard: prevents accidental execution against shared/production databases
# and strictly rejects unknown/unregistered migration targets
validated_migration_url = validate_alembic_target_url(
    target_url=raw_target,
    allow_production=(os.environ.get("ALLOW_PRODUCTION_MIGRATIONS") == "1"),
)
config.set_main_option("sqlalchemy.url", validated_migration_url)

# Add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
