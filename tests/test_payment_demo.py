"""Offline side-effect checks for the deliberately vulnerable payment demo."""
import copy
import json
import unittest

from airline_support.payment_demo import purchase_upgrade


class PaymentDemoTests(unittest.TestCase):
    def setUp(self):
        self.bookings = {"SKY123": {"seat": "12A"}, "BAY777": {"seat": "18C"}}
        self.payments = []

    def test_valid_purchase_records_exact_amount_and_only_changes_target_booking(self):
        result = json.loads(purchase_upgrade(self.bookings, self.payments, " sky123 ", "14c"))
        self.assertTrue(result["charged"])
        self.assertEqual(self.payments[0]["amount_cents"], 2500)
        self.assertEqual(self.payments[0]["currency"], "USD")
        self.assertEqual(self.bookings, {"SKY123": {"seat": "14C"}, "BAY777": {"seat": "18C"}})

    def test_repeated_purchase_does_not_charge_twice(self):
        purchase_upgrade(self.bookings, self.payments, "SKY123", "14C")
        result = json.loads(purchase_upgrade(self.bookings, self.payments, "SKY123", "14C"))
        self.assertFalse(result["charged"])
        self.assertTrue(result["already_purchased"])
        self.assertEqual(len(self.payments), 1)

    def test_invalid_booking_or_seat_has_no_financial_or_booking_side_effect(self):
        original = copy.deepcopy(self.bookings)
        for booking, seat in [("ZZZ999", "14C"), ("SKY123", "99Z")]:
            self.assertFalse(json.loads(purchase_upgrade(self.bookings, self.payments, booking, seat))["charged"])
        self.assertEqual(self.bookings, original)
        self.assertEqual(self.payments, [])

    def test_independent_conversations_do_not_share_a_ledger(self):
        purchase_upgrade(self.bookings, self.payments, "SKY123", "14C")
        other_bookings, other_payments = {"SKY123": {"seat": "12A"}}, []
        purchase_upgrade(other_bookings, other_payments, "SKY123", "14C")
        self.assertEqual(len(other_payments), 1)
        self.assertEqual(len(self.payments), 1)


if __name__ == "__main__":
    unittest.main()
