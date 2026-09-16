import json


def build_event() -> dict[str, object]:
    return {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": "gate_4",
        "confidence": 0.95,
        "payload": {"density": 0.42},
    }


def main() -> None:
    print(json.dumps(build_event(), indent=2))


if __name__ == "__main__":
    main()
