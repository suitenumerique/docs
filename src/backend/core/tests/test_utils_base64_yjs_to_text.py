"""Test util base64_yjs_to_text."""

import base64
import uuid

import y_py

from core import utils
from core.utils import base64_yjs_to_text


def test_utils_base64_yjs_to_text():
    """
    Test extract_text_from_saved_yjs_document
    This base64 string is an example of what is saved in the database.
    This base64 is generated from the blocknote editor, it contains
    the text \n# *Hello* \n- w**or**ld
    """
    base64_string = (
        "AR717vLVDgAHAQ5kb2N1bWVudC1zdG9yZQMKYmxvY2tHcm91cAcA9e7y1Q4AAw5ibG9ja0NvbnRh"
        "aW5lcgcA9e7y1Q4BAwdoZWFkaW5nBwD17vLVDgIGBgD17vLVDgMGaXRhbGljAnt9hPXu8tUOBAVI"
        "ZWxsb4b17vLVDgkGaXRhbGljBG51bGwoAPXu8tUOAg10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y"
        "1Q4CBWxldmVsAX0BKAD17vLVDgECaWQBdyQwNGQ2MjM0MS04MzI2LTQyMzYtYTA4My00ODdlMjZm"
        "YWQyMzAoAPXu8tUOAQl0ZXh0Q29sb3IBdwdkZWZhdWx0KAD17vLVDgEPYmFja2dyb3VuZENvbG9y"
        "AXcHZGVmYXVsdIf17vLVDgEDDmJsb2NrQ29udGFpbmVyBwD17vLVDhADDmJ1bGxldExpc3RJdGVt"
        "BwD17vLVDhEGBAD17vLVDhIBd4b17vLVDhMEYm9sZAJ7fYT17vLVDhQCb3KG9e7y1Q4WBGJvbGQE"
        "bnVsbIT17vLVDhcCbGQoAPXu8tUOEQ10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y1Q4QAmlkAXck"
        "ZDM1MWUwNjgtM2U1NS00MjI2LThlYTUtYWJiMjYzMTk4ZTJhKAD17vLVDhAJdGV4dENvbG9yAXcH"
        "ZGVmYXVsdCgA9e7y1Q4QD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHSH9e7y1Q4QAw5ibG9ja0Nv"
        "bnRhaW5lcgcA9e7y1Q4eAwlwYXJhZ3JhcGgoAPXu8tUOHw10ZXh0QWxpZ25tZW50AXcEbGVmdCgA"
        "9e7y1Q4eAmlkAXckODk3MDBjMDctZTBlMS00ZmUwLWFjYTItODQ5MzIwOWE3ZTQyKAD17vLVDh4J"
        "dGV4dENvbG9yAXcHZGVmYXVsdCgA9e7y1Q4eD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHQA"
    )

    assert base64_yjs_to_text(base64_string) == "Hello world"


def test_utils_extract_attachments():
    """
    All attachment keys in the document content should be extracted.
    """
    document_id = uuid.uuid4()
    image_key1 = f"{document_id!s}/attachments/{uuid.uuid4()!s}.png"
    image_url1 = f"http://localhost/media/{image_key1:s}"

    image_key2 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url2 = f"http://localhost/{image_key2:s}"

    image_key3 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url3 = f"http://localhost/media/{image_key3:s}"

    ydoc = y_py.YDoc()  # pylint: disable=no-member
    with ydoc.begin_transaction() as txn:
        xml_fragment = ydoc.get_xml_element("document-store")

        xml_image = xml_fragment.push_xml_element(txn, "image")
        xml_image.set_attribute(txn, "src", image_url1)

        xml_image = xml_fragment.push_xml_element(txn, "image")
        xml_image.set_attribute(txn, "src", image_url2)

        xml_paragraph = xml_fragment.push_xml_element(txn, "paragraph")
        xml_text = xml_paragraph.push_xml_text(txn)
        xml_text.push(txn, image_url3)

    update = y_py.encode_state_as_update(ydoc)  # pylint: disable=no-member
    base64_string = base64.b64encode(update).decode("utf-8")

    # image_url3 is missing the "/media/" part and shouldn't get extracted
    assert utils.extract_attachments(base64_string) == [image_key1, image_key3]
