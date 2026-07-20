import urllib.request
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    
    if data:
        req.add_header("Content-Type", "application/json")
        json_data = json.dumps(data).encode("utf-8")
        req.data = json_data
        
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        return e.code, json.loads(res_body) if res_body else None
    except Exception as e:
        print(f"Error connecting to {url}: {e}")
        return None, None

def run_tests():
    print("--- Iniciando testes de API do Copo Social ---")

    # Test 1: Config endpoint
    status, config = test_endpoint("/api/config")
    print(f"Test 1 (GET /api/config): Status {status}, Response: {config}")
    assert status == 200
    assert config["event_active"] is True

    # Test 2: List users (Mock profiles should be present)
    status, users = test_endpoint("/api/users")
    print(f"Test 2 (GET /api/users): Status {status}, Found {len(users)} users.")
    assert status == 200
    assert len(users) >= 5
    assert any(u["name"] == "Carol" for u in users)

    # Test 3: Register a new user
    new_user = {
        "cup_id": "test_cup_99",
        "name": "Alex",
        "age": 24,
        "clothes": "Jaqueta verde neon",
        "instagram": "alex_vibe",
        "avatar": "boy2",
        "location": "Pista"
    }
    status, reg_res = test_endpoint("/api/register", method="POST", data=new_user)
    print(f"Test 3 (POST /api/register): Status {status}, Success: {reg_res.get('success')}")
    assert status == 200
    assert reg_res["success"] is True
    assert reg_res["user"]["name"] == "Alex"

    # Test 4: Like (Send cheers)
    like_data = {
        "from_cup_id": "test_cup_99",
        "to_cup_id": "cup_mock1"  # Carol
    }
    status, like_res = test_endpoint("/api/like", method="POST", data=like_data)
    print(f"Test 4 (POST /api/like): Status {status}, Match: {like_res.get('match')}")
    assert status == 200
    assert like_res["success"] is True
    assert like_res["match"] is False

    # Test 5: Mutual Like (Match!)
    like_back_data = {
        "from_cup_id": "cup_mock1",
        "to_cup_id": "test_cup_99"
    }
    status, like_back_res = test_endpoint("/api/like", method="POST", data=like_back_data)
    print(f"Test 5 (POST /api/like - Back): Status {status}, Match: {like_back_res.get('match')}")
    assert status == 200
    assert like_back_res["match"] is True
    match_id = like_back_res["match_id"]
    print(f"Match ID gerado: {match_id}")

    # Test 6: Chat Message
    msg_data = {
        "match_id": match_id,
        "sender": "test_cup_99",
        "text": "Eai Carol! Gostei do seu look."
    }
    status, msg_res = test_endpoint("/api/messages", method="POST", data=msg_data)
    print(f"Test 6 (POST /api/messages): Status {status}, Success: {msg_res.get('success')}")
    assert status == 200

    # Test 7: Get Messages
    status, msgs = test_endpoint(f"/api/messages?match_id={match_id}")
    print(f"Test 7 (GET /api/messages): Status {status}, Total messages in chat: {len(msgs)}")
    assert status == 200
    assert len(msgs) == 2
    # Avoid printing emojis from bot replies in windows stdout
    print("Mensagem 1 enviada com sucesso")
    print("Mensagem 2 recebida do bot simulador com sucesso")

    # Reset backend state
    status, reset_res = test_endpoint("/api/admin/reset", method="POST")
    print(f"Test 8 (POST /api/admin/reset): Status {status}, Reset: {reset_res.get('success')}")
    assert status == 200

    print("--- Todos os testes de API passaram com sucesso! ---")

if __name__ == "__main__":
    run_tests()
