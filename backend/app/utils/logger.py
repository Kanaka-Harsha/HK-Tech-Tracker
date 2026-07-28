import logging

logging.basicConfig(
    filename = "Roadmap_UpdateLog.log",
    level = logging.INFO,
    format = "%(asctime)s | %(levelname)s | %(message)s"
)

log = logging.getLogger("Roadmap_Tracker")