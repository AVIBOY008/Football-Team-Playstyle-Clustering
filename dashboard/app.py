
import streamlit as st
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import plotly.express as px
from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA

st.set_page_config(
    page_title="Football Playstyle Analyzer",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <h1 style='text-align: center;'>Football Playstyle Classification Dashboard</h1>
    <hr>
""", unsafe_allow_html=True)

st.sidebar.title("Navigation")
section = st.sidebar.radio(
    "Go to",
    ["Overview", "Team Analysis", "Prediction", "Clusters"]
)

team_df = pd.read_csv("../data/national_predictions.csv")

model = joblib.load("../models/knn_classifier.pkl")
scaler = joblib.load("../models/scaler.pkl")

radar_features = [
    "passes",
    "shots",
    "average_pass_length",
    "xg_per_shot",
    "ppda"
]

radar_scaler = MinMaxScaler()
radar_scaler.fit(team_df[radar_features])

def plot_radar(team_name):
    row = team_df[team_df["team"] == team_name][radar_features]
    scaled = radar_scaler.transform(row)[0]

    angles = np.linspace(0, 2*np.pi, len(radar_features), endpoint=False)

    scaled = np.append(scaled, scaled[0])
    angles = np.append(angles, angles[0])

    fig = plt.figure()
    ax = fig.add_subplot(111, polar=True)

    ax.plot(angles, scaled)
    ax.fill(angles, scaled, alpha=0.3)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(radar_features)

    ax.set_ylim(0, 1)

    return fig

if section == "Overview":
    st.header("Dataset Overview")

    col1, col2, col3 = st.columns(3)

    col1.metric("Teams", team_df["team"].nunique())
    col2.metric("Avg Passes", int(team_df["passes"].mean()))
    col3.metric("Avg PPDA", round(team_df["ppda"].mean(), 2))

    st.markdown("### Playstyle Distribution")
    st.bar_chart(team_df["playstyle"].value_counts())

    with st.expander("View Raw Data"):
        st.dataframe(team_df)

elif section == "Team Analysis":
    st.header("Team Analysis")

    team = st.selectbox("Select Team", sorted(team_df["team"].unique()))
    team_data = team_df[team_df["team"] == team]

    col1, col2 = st.columns([1, 2])

    with col1:
        st.subheader("Key Stats")
        st.metric("Passes", int(team_data["passes"].values[0]))
        st.metric("Shots", int(team_data["shots"].values[0]))
        st.metric("PPDA", round(team_data["ppda"].values[0], 2))
        st.metric("xG/Shot", round(team_data["xg_per_shot"].values[0], 2))

    with col2:
        st.subheader("Playstyle Radar")
        st.pyplot(plot_radar(team))

elif section == "Prediction":
    st.header("Predict Playstyle")

    col1, col2 = st.columns(2)

    with col1:
        passes = st.slider("Passes", 200, 800, 400)
        shots = st.slider("Shots", 0, 30, 10)
        avg_pass_len = st.slider("Avg Pass Length", 0, 30, 20)
        carries = st.slider("Carries", 100, 700, 300)

    with col2:
        ppda = st.slider("PPDA", 0.5, 20.0, 5.0)
        xg_per_shot = st.slider("xG per Shot", 0.0, 5.0, 1.0)
        deep = st.slider("Angle Deep", -1.0, 1.0, 0.01)
        mid = st.slider("Angle Mid", -1.0, 1.0, 0.01)
        final = st.slider("Angle Final", -1.0, 1.0, 0.01)

    st.markdown("---")

    if st.button("Predict Playstyle"):
        input_data = pd.DataFrame([{
            "passes": passes,
            "shots": shots,
            "average_pass_length": avg_pass_len,
            "ppda": ppda,
            "avg_pass_angle_deep": deep,
            "avg_pass_angle_mid": mid,
            "avg_pass_angle_final": final,
            "xg_per_shot": xg_per_shot,
            "carries_per_pass": carries / passes
        }])

        scaled = scaler.transform(input_data)
        prediction = model.predict(scaled)[0]

        st.success(f"Predicted Playstyle: **{prediction}**")

elif section == "Clusters":
    st.header("Playstyle Clusters")

    X = scaler.transform(team_df.drop(columns=["team", "playstyle"]))

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("2D View")

        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X)

        df_2d = pd.DataFrame({
            "PC1": X_pca[:, 0],
            "PC2": X_pca[:, 1],
            "team": team_df["team"],
            "cluster": team_df["playstyle"]
        })

        fig2d = px.scatter(
            df_2d,
            x="PC1",
            y="PC2",
            color="cluster",
            hover_name="team"
        )

        st.plotly_chart(fig2d, use_container_width=True)

    with col2:
        st.subheader("3D View")

        pca = PCA(n_components=3)
        X_pca = pca.fit_transform(X)

        df_3d = pd.DataFrame({
            "PC1": X_pca[:, 0],
            "PC2": X_pca[:, 1],
            "PC3": X_pca[:, 2],
            "team": team_df["team"],
            "cluster": team_df["playstyle"]
        })

        fig3d = px.scatter_3d(
            df_3d,
            x="PC1",
            y="PC2",
            z="PC3",
            color="cluster",
            hover_name="team"
        )

        st.plotly_chart(fig3d, use_container_width=True)
