# ⚽ Football Team Playstyle Clustering

Machine Learning project that analyzes football teams based on match statistics and groups them into similar playstyle clusters using unsupervised learning techniques.

The project helps identify tactical similarities between teams by analyzing metrics such as passing, shooting, PPDA, expected goals (xG), and average pass length.

---

## 📌 Project Overview

Different football teams have unique tactical identities.

This project uses machine learning to automatically cluster teams with similar playing styles based on statistical data.

Examples include:

- Possession-based teams
- Direct attacking teams
- High-pressing teams
- Defensive/low-block teams

The project also includes a web dashboard built using Flask for interactive visualization and exploration.

---

## 🚀 Features

- Data preprocessing and feature engineering
- Exploratory Data Analysis (EDA)
- Feature scaling
- Team clustering
- Team classification
- Interactive Flask dashboard
- Data visualization using Matplotlib and Seaborn

---

## 📊 Dataset

The project uses football match statistics including:

- Passes
- Shots
- PPDA
- Expected Goals (xG)
- Average Pass Length

Processed datasets are available inside the `data/` directory.

---

## 🛠️ Tech Stack

- Python
- Pandas
- NumPy
- Scikit-learn
- Matplotlib
- Seaborn
- Flask
- HTML
- CSS
- JavaScript

---

## 📂 Project Structure

```
Football-Team-Playstyle-Clustering/
│
├── dashboard/
│   ├── static/
│   ├── templates/
│   ├── app.py
│
├── data/
│
├── models/
│
├── notebooks/
│   ├── 01_data_loading.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_data_clustering.ipynb
│   ├── 04_data_classification.ipynb
│   └── 05_nation_classification.ipynb
│
└── README.md
```

---

## ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/AVIBOY008/Football-Team-Playstyle-Clustering.git
```

Navigate to the project directory

```bash
cd Football-Team-Playstyle-Clustering
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run the Flask dashboard

```bash
cd dashboard
python app.py
```

---

## 📈 Machine Learning Workflow

1. Data Collection
2. Data Cleaning
3. Feature Engineering
4. Feature Scaling
5. Exploratory Data Analysis
6. Clustering
7. Classification
8. Model Evaluation
9. Dashboard Visualization

---

## 📷 Screenshots

Add screenshots of:

- Dashboard
- Cluster Visualization
- Distribution Plots
- Model Results

---

## 🔮 Future Improvements

- More advanced clustering algorithms
- Live football data integration
- Player-level analysis
- Tactical similarity search
- Streamlit deployment
- Cloud deployment

---

## 👨‍💻 Author

**Avichal Bhattacharjee**

GitHub: https://github.com/AVIBOY008

---

## 📄 License

This project is intended for educational and research purposes.
