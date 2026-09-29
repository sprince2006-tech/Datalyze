# DataLyze

Instant data analysis — upload a CSV, Excel, or JSON file and get a full analytics dashboard in seconds.

## Stack
- **Frontend:** React 18, Vite, Tailwind, React Query, Recharts
- **Backend:** Express 4, Mongoose, JWT, Multer, PDFKit, Socket.IO
- **ML Service:** FastAPI, pandas, NumPy, scikit-learn
- **Database:** MongoDB

## Quick start

```bash
# Backend
cd backend && npm install && npm run dev

# ML service
cd ml-service && python -m venv venv && venv\Scripts\pip install -r requirements.txt
venv\Scripts\python main.py

# Frontend
cd frontend && npm install && npm run dev