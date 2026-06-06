# Graph Explorer

Aplikacja webowa do interaktywnej eksploracji i wizualizacji dużych grafów.

## Wymagania

- Java 21 (JDK)
- Apache Maven 3.9+
- Apache Tomcat 10

## Budowanie

W katalogu głównym projektu uruchom:

```bash
mvn clean package
```

Po zakończeniu w katalogu `target/` powstanie plik z rozszerzeniem .war.

## Uruchamianie

1. Skopiuj plik z rozszerzeniem .war do katalogu `webapps/` w instalacji Tomcata 10.
2. Uruchom Tomcata:

   ```bash
   # Linux / macOS
   ./bin/startup.sh

   # Windows
   bin\startup.bat
   ```

3. Otwórz aplikację w przeglądarce:

   ```
   http://localhost:8080/[nazwa_aplikacji]/
   ```
