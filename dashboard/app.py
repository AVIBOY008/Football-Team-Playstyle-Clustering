
import streamlit as st
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import plotly.express as px
from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA
from sklearn.neighbors import KernelDensity

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
    ["Overview", "Team Analysis", "Prediction", "Simulation", "Clusters"]
)

team_df = pd.read_csv("../data/national_predictions.csv")
match_df = pd.read_csv("../data/matchwise_processed.csv")

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

elif section == "Simulation":
    st.header("Match Playstyle Simulator")
    st.markdown("""
        This tool uses **Kernel Density Estimation (KDE)** to simulate team match statistics based on historical match performances. 
        It then feeds the simulated match data into our classification model to predict the team's playstyle for that simulated match.
    """)

    # Select Mode: Generic or Team-specific
    sim_mode = st.radio("Simulation Target", ["Generic (All Teams)", "Specific Team"])

    if sim_mode == "Specific Team":
        selected_team = st.selectbox("Select Team to Simulate", sorted(match_df["team"].unique()))
        sim_data = match_df[match_df["team"] == selected_team]
    else:
        selected_team = None
        sim_data = match_df

    # Features to simulate:
    sim_features = [
        "passes", "shots", "average_pass_length", "ppda",
        "avg_pass_angle_deep", "avg_pass_angle_mid", "avg_pass_angle_final",
        "xg_per_shot", "carries_per_pass"
    ]

    col_btn, _ = st.columns([1, 3])
    with col_btn:
        generate_btn = st.button("Generate Simulated Match", use_container_width=True)

    if generate_btn:
        simulated_stats = {}
        for col in sim_features:
            # Reshape data
            X = sim_data[col].values.reshape(-1, 1)
            # Fit KDE
            kde = KernelDensity(kernel="gaussian", bandwidth='silverman').fit(X)
            # Sample
            sampled_val = kde.sample(1)[0][0]
            # Clip to min and max of current dataset slice to prevent impossible values
            min_val = sim_data[col].min()
            max_val = sim_data[col].max()
            sampled_val = np.clip(sampled_val, min_val, max_val)
            simulated_stats[col] = sampled_val
        
        st.session_state["simulated_match"] = simulated_stats
        st.session_state["simulated_team"] = selected_team

    # Display results if simulation exists in session state
    if "simulated_match" in st.session_state:
        sim_stats = st.session_state["simulated_match"]
        sim_team = st.session_state["simulated_team"]

        # Alert/Info banner based on simulated target
        if sim_team:
            st.info(f"Showing simulated performance for: **{sim_team}**")
        else:
            st.info("Showing simulated performance for: **Generic Team**")

        # Create input dataframe and predict playstyle
        input_data = pd.DataFrame([sim_stats])
        scaled = scaler.transform(input_data)
        prediction = model.predict(scaled)[0]

        # Display predicted playstyle in a nice big card
        st.success(f"Predicted Playstyle for Simulated Match: **{prediction}**")

        st.markdown("### Simulated Match Statistics vs Average")
        
        col1, col2 = st.columns([2, 3])
        
        with col1:
            st.subheader("Simulated Metrics")
            
            # Map features to reader-friendly display and compare to baseline average
            if sim_team:
                baseline_df = team_df[team_df["team"] == sim_team]
            else:
                baseline_df = team_df.mean(numeric_only=True).to_frame().T
            
            # Passes
            sim_passes = int(sim_stats["passes"])
            base_passes = int(baseline_df["passes"].values[0])
            
            # Shots
            sim_shots = int(sim_stats["shots"])
            base_shots = int(baseline_df["shots"].values[0])
            
            # PPDA (Passes Allowed per Defensive Action)
            sim_ppda = sim_stats["ppda"]
            base_ppda = baseline_df["ppda"].values[0]
            
            # xG per Shot
            sim_xg = sim_stats["xg_per_shot"]
            base_xg = baseline_df["xg_per_shot"].values[0]
            
            # Carries per pass
            sim_cpp = sim_stats["carries_per_pass"]
            base_cpp = baseline_df["carries_per_pass"].values[0]

            # Pass angles
            sim_pad = sim_stats["avg_pass_angle_deep"]
            base_pad = baseline_df["avg_pass_angle_deep"].values[0]
            sim_pam = sim_stats["avg_pass_angle_mid"]
            base_pam = baseline_df["avg_pass_angle_mid"].values[0]
            sim_paf = sim_stats["avg_pass_angle_final"]
            base_paf = baseline_df["avg_pass_angle_final"].values[0]
            
            # Average pass length
            sim_apl = sim_stats["average_pass_length"]
            base_apl = baseline_df["average_pass_length"].values[0]

            # Create a 3x3 grid of metrics inside col1
            m_col1, m_col2, m_col3 = st.columns(3)
            with m_col1:
                st.metric("Passes", sim_passes, delta=sim_passes - base_passes)
                st.metric("Avg Pass Length", f"{sim_apl:.1f}m", delta=f"{sim_apl - base_apl:.1f}m")
                st.metric("Pass Angle (Deep)", f"{sim_pad:.2f}", delta=f"{sim_pad - base_pad:.2f}")
            with m_col2:
                st.metric("Shots", sim_shots, delta=sim_shots - base_shots)
                st.metric("xG per Shot", f"{sim_xg:.3f}", delta=f"{sim_xg - base_xg:.3f}")
                st.metric("Pass Angle (Mid)", f"{sim_pam:.2f}", delta=f"{sim_pam - base_pam:.2f}")
            with m_col3:
                st.metric("PPDA", f"{sim_ppda:.2f}", delta=f"{sim_ppda - base_ppda:.2f}", delta_color="inverse")
                st.metric("Carries per Pass", f"{sim_cpp:.3f}", delta=f"{sim_cpp - base_cpp:.3f}")
                st.metric("Pass Angle (Final)", f"{sim_paf:.2f}", delta=f"{sim_paf - base_paf:.2f}")
            
        with col2:
            st.subheader("Radar Chart Comparison")
            
            # Setup radar chart data
            if sim_team:
                avg_row = team_df[team_df["team"] == sim_team][radar_features]
                label_avg = f"{sim_team} Average"
            else:
                avg_row = team_df[radar_features].mean(numeric_only=True).to_frame().T
                label_avg = "Overall Average"
                
            scaled_avg = radar_scaler.transform(avg_row)[0]
            
            sim_row_df = pd.DataFrame([sim_stats])[radar_features]
            scaled_sim = radar_scaler.transform(sim_row_df)[0]
            
            angles = np.linspace(0, 2*np.pi, len(radar_features), endpoint=False)
            
            scaled_avg = np.append(scaled_avg, scaled_avg[0])
            scaled_sim = np.append(scaled_sim, scaled_sim[0])
            angles = np.append(angles, angles[0])
            
            # Plot
            fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
            
            # Styling
            fig.patch.set_facecolor('#ffffff')
            ax.set_facecolor('#f7f9fa')
            
            # Draw baseline average
            ax.plot(angles, scaled_avg, label=label_avg, color="#1f77b4", linewidth=2.5)
            ax.fill(angles, scaled_avg, color="#1f77b4", alpha=0.15)
            
            # Draw simulated match
            ax.plot(angles, scaled_sim, label="Simulated Performance", color="#ff7f0e", linewidth=2.5, linestyle="--")
            ax.fill(angles, scaled_sim, color="#ff7f0e", alpha=0.25)
            
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(radar_features, fontsize=10, fontweight='bold')
            
            ax.set_ylim(0, 1)
            ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1))
            
            st.pyplot(fig)

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
