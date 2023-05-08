#!/bin/bash

password=seniorTablet
db_name=seniorHappyDB

docker run -e POSTGRES_PASSWORD="${password}" -e POSTGRES_DB="${db_name}" -p 5432:5432 --rm postgres