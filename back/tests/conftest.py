import sys
from pathlib import Path

# Assure que les imports `application.*` et `infrastructure.*` marchent quand on lance pytest depuis `back/`.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

