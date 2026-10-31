# Test helper: lets the pure-logic tests run even when pydantic-settings is not installed (not needed on your machine).
import sys
import types

try:
    import pydantic_settings  # noqa: F401
except ImportError:  # minimal stand-in
    m = types.ModuleType("pydantic_settings")

    class BaseSettings:
        def __init__(self, **kw):
            for k, v in vars(type(self)).items():
                if not k.startswith("_") and not callable(v) and not isinstance(v, property):
                    setattr(self, k, v)

    m.BaseSettings = BaseSettings
    m.SettingsConfigDict = lambda **kw: kw
    sys.modules["pydantic_settings"] = m

try:
    import pydantic  # noqa: F401
except ImportError:  # only needed so schema classes can be imported without pydantic installed
    pm = types.ModuleType("pydantic")

    class BaseModel:  # noqa: D401
        pass

    pm.BaseModel = BaseModel
    sys.modules["pydantic"] = pm
