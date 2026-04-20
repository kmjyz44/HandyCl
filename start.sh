#!/bin/bash
pip3 install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port $PORT
