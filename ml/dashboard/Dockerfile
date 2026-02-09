FROM python:3.12-slim

WORKDIR /app

# Copy and install dashboard dependencies
COPY ml/dashboard/requirements.txt ./requirements.txt
COPY ml/requirements.txt ./ml-requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -r ml-requirements.txt

# Copy the full ml/ directory (needed for pipeline subprocess execution)
COPY ml/ ./ml/

ENV PYTHONPATH=/app
EXPOSE 7860

CMD ["streamlit", "run", "ml/dashboard/app.py", "--server.port=7860", "--server.address=0.0.0.0", "--server.headless=true"]
