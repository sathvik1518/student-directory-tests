"""The same 30 students every time, so every test knows what to expect."""
CLASSES = ["6A", "6B", "7A", "7B", "8A"]
NAMES = [
    "Aarav Reddy", "Diya Goud", "Rohan Naidu", "Meera Rao", "Karthik Sharma", "Ananya Patel",
    "Teja Kumar", "Priya Verma", "Vivaan Yadav", "Isha Gupta", "Arjun Singh", "Sneha Mehta",
    "Harsha Nair", "Pooja Iyer", "Nikhil Joshi", "Divya Das", "Sai Pillai", "Keerthi Menon",
    "Varun Bhat", "Anjali Shetty", "Rahul Jain", "Navya Thakur", "Charan Reddy", "Harini Goud",
    "Pranav Rao", "Bhavana Naidu", "Aditya Kumar", "Lakshmi Sharma", "Krishna Patel", "Sirisha Verma",
]


def seed_rows() -> list[tuple[str, str, int]]:
    """(name, class_name, score). Class and score follow the position, so they never change between runs."""
    return [(name, CLASSES[i % len(CLASSES)], 40 + (i * 7) % 61) for i, name in enumerate(NAMES)]
