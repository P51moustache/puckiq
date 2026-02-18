FROM python:3.12-slim

WORKDIR /app

# Copy and install dashboard dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy dashboard files (flat structure: app.py, data.py, pages/)
COPY . .

EXPOSE 7860

CMD ["streamlit", "run", "app.py", "--server.port=7860", "--server.address=0.0.0.0", "--server.headless=true"]
