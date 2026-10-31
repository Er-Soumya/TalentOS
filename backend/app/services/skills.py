"""Skill catalogue + alias normalisation (ported and extended from the old backend)."""
import re

# canonical name -> extra aliases (lower case). The canonical name itself is always an alias.
CATALOG = {
    # languages
    "Python": ["py", "python3"], "Java": ["core java"], "JavaScript": ["js", "es6", "ecmascript"],
    "TypeScript": ["ts"], "C": ["c programming"], "C++": ["cpp", "c++ programming"], "C#": ["csharp", "c sharp"],
    "Go": ["golang"], "Rust": [], "PHP": [], "Ruby": [], "Kotlin": [], "Swift": [], "R": ["r programming"],
    "Scala": [], "SQL": ["structured query language"], "Bash": ["bash scripting", "shell scripting", "shell"],
    "MATLAB": [],
    # web
    "React": ["reactjs", "react.js", "react js"], "Angular": ["angularjs", "angular.js"], "Vue": ["vue.js", "vuejs"],
    "Next.js": ["nextjs"], "Node.js": ["node", "nodejs", "node js"], "Express": ["express.js", "expressjs"],
    "HTML": ["html5"], "CSS": ["css3"], "Tailwind CSS": ["tailwind", "tailwindcss"], "Bootstrap": [],
    "jQuery": [], "REST API": ["rest", "restful api", "rest apis", "restful apis", "restful"], "GraphQL": [],
    # backend frameworks
    "FastAPI": [], "Django": [], "Flask": [], "Spring Boot": ["springboot", "spring framework"],
    ".NET": ["dotnet", ".net core", "asp.net"], "Microservices": ["microservice"], "System Design": [],
    # data / databases
    "PostgreSQL": ["postgres", "psql"], "MySQL": [], "MongoDB": ["mongo"], "Redis": [], "SQLite": [],
    "Oracle": [], "Elasticsearch": ["elastic search"], "Kafka": ["apache kafka"], "Spark": ["apache spark", "pyspark"],
    "Hadoop": [], "Airflow": ["apache airflow"], "Pandas": [], "NumPy": [], "Power BI": ["powerbi", "power-bi"],
    "Tableau": [], "Excel": ["ms excel", "microsoft excel"], "Data Analysis": ["data analytics"], "ETL": [],
    # AI / ML
    "Machine Learning": ["ml", "machine-learning"], "Deep Learning": ["deep-learning"],
    "Artificial Intelligence": ["ai", "artificial-intelligence"], "NLP": ["natural language processing"],
    "Computer Vision": ["image processing"], "TensorFlow": [], "PyTorch": ["torch"], "Keras": [],
    "Scikit-learn": ["sklearn", "scikit learn"], "XGBoost": [], "LLM": ["large language model", "large language models", "llms"],
    "Generative AI": ["genai", "gen ai", "generative artificial intelligence"],
    "RAG": ["retrieval augmented generation", "retrieval-augmented generation"], "LangChain": [],
    "Transformers": ["transformer", "hugging face", "huggingface"], "OpenCV": [], "Statistics": [],
    "Data Science": [], "MLOps": [], "Explainable AI": ["xai"], "Grad-CAM": ["gradcam"],
    # cloud / devops
    "AWS": ["amazon web services"], "Azure": ["microsoft azure"], "GCP": ["google cloud", "google cloud platform"],
    "Docker": [], "Kubernetes": ["k8s"], "Terraform": [], "Jenkins": [], "CI/CD": ["cicd", "ci cd", "continuous integration"],
    "Git": [], "GitHub": [], "GitLab": [], "Linux": [], "Ansible": [], "Nginx": [],
    # other
    "Agile": ["scrum"], "JIRA": [], "Figma": [], "UI/UX": ["ui ux", "ux design", "ui design"],
    "Embedded Systems": ["embedded"], "AUTOSAR": [], "Simulink": [],
    "Object-Oriented Programming": ["oop", "oops", "object oriented programming"],
    "Data Structures": ["dsa", "data structures and algorithms"], "Unit Testing": ["pytest", "junit"],
    "Selenium": [], "Communication": [], "Leadership": [], "Problem Solving": [], "Teamwork": [],
}

# aliases that are too ambiguous to search for inside free text (still used for exact skill-list matches)
TEXT_SKIP = {"c", "r", "go", "cv", "dl", "tf", "ts", "py", "shell", "embedded", "rest", "node", "torch", "image processing"}


def _key(s):
    return re.sub(r"\s+", " ", str(s).strip().lower()).strip(" .,;:")


ALIAS_TO_CANON = {}
VARIANTS = {}
for _canon, _aliases in CATALOG.items():
    _all = {_key(_canon), *[_key(a) for a in _aliases]}
    VARIANTS[_canon] = sorted(_all, key=len, reverse=True)
    for _a in _all:
        ALIAS_TO_CANON.setdefault(_a, _canon)


def canon(skill):
    """'reactjs' -> 'React'. Unknown skills are returned cleaned but unchanged."""
    s = str(skill or "").strip().strip(",;:")
    if not s:
        return ""
    return ALIAS_TO_CANON.get(_key(s), s)


def dedupe(skills):
    seen, out = set(), []
    for s in skills or []:
        c = canon(s)
        if c and c.lower() not in seen:
            seen.add(c.lower())
            out.append(c)
    return out


def _pattern(variant):
    return r"(?<![a-z0-9+#.])" + re.escape(variant) + r"(?![a-z0-9+#])"


def skill_position(skill, text_lower):
    """Index of the first mention of the skill (any alias) in the text, or -1."""
    c = canon(skill)
    best = -1
    for v in VARIANTS.get(c, [_key(c)]):
        if v in TEXT_SKIP or len(v) < 2:
            continue
        m = re.search(_pattern(v), text_lower)
        if m and (best == -1 or m.start() < best):
            best = m.start()
    return best


def skill_in_text(skill, text_lower):
    return skill_position(skill, text_lower) >= 0


def find_skills_in_text(text, limit=60):
    """Known skills mentioned in the text, ordered by first appearance."""
    low = (text or "").lower()
    found = []
    for c in CATALOG:
        pos = skill_position(c, low)
        if pos >= 0:
            found.append((pos, c))
    found.sort()
    return [c for _, c in found][:limit]
