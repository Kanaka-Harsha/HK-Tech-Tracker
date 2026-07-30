CREATE TABLE roadmaps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roadmaps(name)
VALUES
	('DSA'),
	('TERRAFORM'),
	('Linux'),
	('DBMS'),
	('OS'),
	('OOPS'),
	('CN'),
	('CLOUD'),
	('AWS'),
	('SYSDES');

SELECT * FROM roadmaps;

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    roadmap_id INTEGER NOT NULL,
    main_topic VARCHAR(100) NOT NULL,
    sub_topic VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (roadmap_id)
        REFERENCES roadmaps(id)
        ON DELETE CASCADE
);

SELECT * from tasks;

CREATE TABLE notes (
    roadmap_id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_roadmap
        FOREIGN KEY (roadmap_id)
        REFERENCES roadmaps(name)
        ON DELETE CASCADE
);

INSERT INTO notes (roadmap_id, title, notes)
VALUES (
    'DSA',
    'Test Note',
    'This is a demo note, nothing is important here.'
);

SELECT * from notes;