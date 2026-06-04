import os
import joblib
import pandas as pd
import numpy as np
from flask import Flask, render_template, jsonify, request
from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA
from sklearn.neighbors import KernelDensity

app = Flask(__name__)

# Absolute paths based on current file location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")

# Load datasets
team_df = pd.read_csv(os.path.join(DATA_DIR, "national_predictions.csv"))
match_df = pd.read_csv(os.path.join(DATA_DIR, "matchwise_processed.csv"))

# Load scikit-learn models
model = joblib.load(os.path.join(MODELS_DIR, "knn_classifier.pkl"))
scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))

# MinMax scaling configuration for radar charts
radar_features = [
    "passes",
    "shots",
    "average_pass_length",
    "xg_per_shot",
    "ppda"
]
radar_scaler = MinMaxScaler()
radar_scaler.fit(team_df[radar_features])

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")

@app.route("/api/overview")
def overview():
    """Return dataset overview aggregates and records."""
    playstyle_counts = team_df["playstyle"].value_counts().to_dict()
    
    # Convert dataframe records to a JSON-compatible list of dicts
    teams_data = team_df.to_dict(orient="records")
    
    return jsonify({
        "team_count": int(team_df["team"].nunique()),
        "avg_passes": float(team_df["passes"].mean()),
        "avg_ppda": float(team_df["ppda"].mean()),
        "playstyle_counts": playstyle_counts,
        "teams_data": teams_data
    })

@app.route("/api/teams")
def teams_list():
    """Return a sorted list of unique team names."""
    teams = sorted(team_df["team"].unique().tolist())
    return jsonify(teams)

@app.route("/api/team/<team_name>")
def team_details(team_name):
    """Return stats and radar scaling coordinates for a team."""
    team_data = team_df[team_df["team"] == team_name]
    if team_data.empty:
        return jsonify({"error": "Team not found"}), 404
    
    row = team_data.iloc[0]
    
    # Apply MinMaxScaler for radar data representation
    radar_row = team_data[radar_features]
    scaled_radar = radar_scaler.transform(radar_row)[0].tolist()
    
    return jsonify({
        "team": row["team"],
        "playstyle": row["playstyle"],
        "stats": {
            "passes": int(row["passes"]),
            "shots": int(row["shots"]),
            "average_pass_length": float(row["average_pass_length"]),
            "ppda": float(row["ppda"]),
            "xg_per_shot": float(row["xg_per_shot"])
        },
        "radar_data": scaled_radar
    })

@app.route("/api/predict", methods=["POST"])
def predict_playstyle():
    """Predict playstyle based on manual feature inputs."""
    data = request.json
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    try:
        passes = float(data.get("passes", 400))
        shots = float(data.get("shots", 10))
        avg_pass_length = float(data.get("average_pass_length", 20))
        carries = float(data.get("carries", 300))
        ppda = float(data.get("ppda", 5.0))
        xg_per_shot = float(data.get("xg_per_shot", 1.0))
        avg_pass_angle_deep = float(data.get("avg_pass_angle_deep", 0.01))
        avg_pass_angle_mid = float(data.get("avg_pass_angle_mid", 0.01))
        avg_pass_angle_final = float(data.get("avg_pass_angle_final", 0.01))
        
        carries_per_pass = carries / passes if passes != 0 else 0
        
        input_data = pd.DataFrame([{
            "passes": passes,
            "shots": shots,
            "average_pass_length": avg_pass_length,
            "ppda": ppda,
            "avg_pass_angle_deep": avg_pass_angle_deep,
            "avg_pass_angle_mid": avg_pass_angle_mid,
            "avg_pass_angle_final": avg_pass_angle_final,
            "xg_per_shot": xg_per_shot,
            "carries_per_pass": carries_per_pass
        }])
        
        # Scale and predict using model pipeline
        scaled = scaler.transform(input_data)
        prediction = model.predict(scaled)[0]
        
        return jsonify({
            "playstyle": prediction
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/simulate", methods=["POST"])
def simulate_match():
    """Simulate team match stats using KDE and predict playstyle."""
    data = request.json or {}
    sim_mode = data.get("sim_mode", "Generic (All Teams)")
    team_name = data.get("team_name", None)
    
    # Filter dataset slice based on mode
    if sim_mode == "Specific Team" and team_name:
        sim_data = match_df[match_df["team"] == team_name]
        if sim_data.empty:
            return jsonify({"error": f"Match data for team '{team_name}' not found"}), 404
    else:
        sim_data = match_df
        
    sim_features = [
        "passes", "shots", "average_pass_length", "ppda",
        "avg_pass_angle_deep", "avg_pass_angle_mid", "avg_pass_angle_final",
        "xg_per_shot", "carries_per_pass"
    ]
    
    simulated_stats = {}
    try:
        for col in sim_features:
            X = sim_data[col].values.reshape(-1, 1)
            # Fit Kernel Density Estimator using Silverman bandwidth rule
            kde = KernelDensity(kernel="gaussian", bandwidth='silverman').fit(X)
            sampled_val = kde.sample(1)[0][0]
            
            # Clip bounds to keep variables inside realistic domain constraints
            min_val = sim_data[col].min()
            max_val = sim_data[col].max()
            sampled_val = np.clip(sampled_val, min_val, max_val)
            
            if col in ["passes", "shots"]:
                simulated_stats[col] = int(round(sampled_val))
            else:
                simulated_stats[col] = float(sampled_val)
                
        # Generate baseline average comparison values
        if sim_mode == "Specific Team" and team_name:
            baseline_df = team_df[team_df["team"] == team_name]
        else:
            baseline_df = team_df.mean(numeric_only=True).to_frame().T
            
        baseline_stats = {
            "passes": float(baseline_df["passes"].values[0]),
            "shots": float(baseline_df["shots"].values[0]),
            "average_pass_length": float(baseline_df["average_pass_length"].values[0]),
            "ppda": float(baseline_df["ppda"].values[0]),
            "avg_pass_angle_deep": float(baseline_df["avg_pass_angle_deep"].values[0]),
            "avg_pass_angle_mid": float(baseline_df["avg_pass_angle_mid"].values[0]),
            "avg_pass_angle_final": float(baseline_df["avg_pass_angle_final"].values[0]),
            "xg_per_shot": float(baseline_df["xg_per_shot"].values[0]),
            "carries_per_pass": float(baseline_df["carries_per_pass"].values[0])
        }
        
        # Predict simulated match playstyle
        input_data = pd.DataFrame([simulated_stats])[sim_features]
        scaled = scaler.transform(input_data)
        prediction = model.predict(scaled)[0]
        
        # Map radar chart features scaled values [0, 1]
        avg_radar_row = baseline_df[radar_features]
        scaled_base_radar = radar_scaler.transform(avg_radar_row)[0].tolist()
        
        sim_radar_row = pd.DataFrame([simulated_stats])[radar_features]
        scaled_sim_radar = radar_scaler.transform(sim_radar_row)[0].tolist()
        
        return jsonify({
            "simulated_stats": simulated_stats,
            "predicted_playstyle": prediction,
            "baseline_stats": baseline_stats,
            "scaled_base_radar": scaled_base_radar,
            "scaled_sim_radar": scaled_sim_radar
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/clusters")
def cluster_projections():
    """Project dataset into 2D and 3D components using PCA."""
    try:
        X = scaler.transform(team_df.drop(columns=["team", "playstyle"]))
        
        # Compute 2D coordinates
        pca_2d = PCA(n_components=2)
        X_pca_2d = pca_2d.fit_transform(X)
        
        # Compute 3D coordinates
        pca_3d = PCA(n_components=3)
        X_pca_3d = pca_3d.fit_transform(X)
        
        cluster_points = []
        for i in range(len(team_df)):
            cluster_points.append({
                "team": team_df.iloc[i]["team"],
                "playstyle": team_df.iloc[i]["playstyle"],
                "pc1_2d": float(X_pca_2d[i, 0]),
                "pc2_2d": float(X_pca_2d[i, 1]),
                "pc1_3d": float(X_pca_3d[i, 0]),
                "pc2_3d": float(X_pca_3d[i, 1]),
                "pc3_3d": float(X_pca_3d[i, 2])
            })
            
        return jsonify(cluster_points)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
