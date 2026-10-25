import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# Fake token, test-only. Never a real credential.
os.environ.setdefault("BOT_TOKEN", "123456789:TESTTOKENxxxxxxxxxxxxxxxxxxxxxxxxxxx")
os.environ.setdefault("ADMIN_IDS", "1")
