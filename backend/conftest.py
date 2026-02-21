"""Pytest configuration and shared fixtures."""
import os
import sys

# Ensure app package is on path when running from repo root or backend/
# __file__ is backend/tests/conftest.py -> backend_dir = backend/
tests_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(tests_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
