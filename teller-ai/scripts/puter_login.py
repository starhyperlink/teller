"""Open Puter and optionally fill its login form for local development."""

import os
import time

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


PUTER_LOGIN_URL = os.getenv("PUTER_LOGIN_URL", "https://puter.com/login")
WAIT_SECONDS = int(os.getenv("PUTER_LOGIN_WAIT_SECONDS", "30"))


def first_visible(wait: WebDriverWait, selectors: list[tuple[str, str]]):
    for by, selector in selectors:
        try:
            return wait.until(EC.visibility_of_element_located((by, selector)))
        except TimeoutException:
            continue
    return None


def auto_login() -> None:
    username = os.getenv("PUTER_USERNAME")
    password = os.getenv("PUTER_PASSWORD")

    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, WAIT_SECONDS)

    try:
        driver.get(PUTER_LOGIN_URL)

        if username and password:
            username_field = first_visible(
                wait,
                [
                    (By.NAME, "username"),
                    (By.NAME, "email"),
                    (By.ID, "username"),
                    (By.ID, "email"),
                    (By.CSS_SELECTOR, "input[type='email']"),
                ],
            )
            password_field = first_visible(
                wait,
                [
                    (By.NAME, "password"),
                    (By.ID, "password"),
                    (By.CSS_SELECTOR, "input[type='password']"),
                ],
            )

            if username_field and password_field:
                username_field.clear()
                username_field.send_keys(username)
                password_field.clear()
                password_field.send_keys(password)

                submit = first_visible(
                    wait,
                    [
                        (By.CSS_SELECTOR, "button[type='submit']"),
                        (By.CSS_SELECTOR, "input[type='submit']"),
                    ],
                )
                if submit:
                    submit.click()
                else:
                    password_field.submit()
            else:
                print("Puter fields were not detected; complete login in the browser.")
        else:
            print("PUTER_USERNAME and PUTER_PASSWORD are not set; complete login in the browser.")

        print(f"Waiting up to {WAIT_SECONDS} seconds for Puter login to complete...")
        time.sleep(WAIT_SECONDS)
        print(f"Current page: {driver.current_url}")
    finally:
        driver.quit()


if __name__ == "__main__":
    auto_login()