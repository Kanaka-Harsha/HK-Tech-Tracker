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