"""
Secrets Management
- Vault integration for secret storage
- Environment variable fallback
- Secret rotation tracking
"""

import os
from typing import Optional, Dict, Any
from datetime import datetime, timezone


class SecretsManager:
    """
    Manages API keys and secrets securely.
    
    Priority order:
    1. HashiCorp Vault (production)
    2. AWS Secrets Manager (cloud)
    3. Environment variables (development)
    4. .env file (local development only)
    """
    
    def __init__(self):
        self.vault_enabled = os.getenv("OCEANET_VAULT_ENABLED", "0").lower() in {"1", "true"}
        self.vault_addr = os.getenv("OCEANET_VAULT_ADDR", "http://localhost:8200")
        self.vault_token = os.getenv("OCEANET_VAULT_TOKEN", "")
        
        self.aws_secrets_enabled = os.getenv("OCEANET_AWS_SECRETS_ENABLED", "0").lower() in {"1", "true"}
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        
        # Track secret access for audit
        self._access_log: Dict[str, list] = {}
    
    def get_secret(self, secret_name: str, default: Optional[str] = None) -> str:
        """
        Get secret value from configured backend.
        
        Args:
            secret_name: Name of the secret (e.g., 'openai_api_key')
            default: Default value if not found
        
        Returns:
            Secret value
        
        Raises:
            ValueError: If secret is required but not found
        """
        # Log access for audit
        self._log_access(secret_name)
        
        # Try Vault first
        if self.vault_enabled:
            value = self._get_from_vault(secret_name)
            if value:
                return value
        
        # Try AWS Secrets Manager
        if self.aws_secrets_enabled:
            value = self._get_from_aws_secrets(secret_name)
            if value:
                return value
        
        # Fall back to environment variables
        env_var_name = secret_name.upper()
        value = os.getenv(env_var_name)
        if value:
            return value
        
        # Return default or raise error
        if default is not None:
            return default
        
        raise ValueError(f"Secret '{secret_name}' not found and no default provided")
    
    def _get_from_vault(self, secret_name: str) -> Optional[str]:
        """Retrieve secret from HashiCorp Vault"""
        if not self.vault_token:
            return None
        
        try:
            import hvac
            
            client = hvac.Client(url=self.vault_addr, token=self.vault_token)
            response = client.secrets.kv.v2.read_secret_version(path=f"oceanet/{secret_name}")
            return response["data"]["data"].get(secret_name)
        except Exception as e:
            print(f"Warning: Failed to get secret from Vault: {e}")
            return None
    
    def _get_from_aws_secrets(self, secret_name: str) -> Optional[str]:
        """Retrieve secret from AWS Secrets Manager"""
        try:
            import boto3
            import json
            
            client = boto3.client("secretsmanager", region_name=self.aws_region)
            response = client.get_secret_value(SecretId=f"oceanet/{secret_name}")
            
            if "SecretString" in response:
                secret = json.loads(response["SecretString"])
                return secret.get(secret_name)
            return None
        except Exception as e:
            print(f"Warning: Failed to get secret from AWS Secrets Manager: {e}")
            return None
    
    def _log_access(self, secret_name: str):
        """Log secret access for audit trail"""
        if secret_name not in self._access_log:
            self._access_log[secret_name] = []
        
        self._access_log[secret_name].append(datetime.now(timezone.utc).isoformat())
    
    def get_access_log(self, secret_name: str) -> list:
        """Get audit log of secret access"""
        return self._access_log.get(secret_name, [])
    
    def rotate_secret(self, secret_name: str, new_value: str) -> bool:
        """
        Rotate secret (move old value to backup, set new value).
        
        Implementation depends on backend (Vault, AWS Secrets Manager, etc.)
        """
        try:
            if self.vault_enabled:
                import hvac
                client = hvac.Client(url=self.vault_addr, token=self.vault_token)
                client.secrets.kv.v2.create_or_update_secret(
                    path=f"oceanet/{secret_name}",
                    secret_data={secret_name: new_value},
                )
                return True
            
            if self.aws_secrets_enabled:
                import boto3
                client = boto3.client("secretsmanager", region_name=self.aws_region)
                client.update_secret(
                    SecretId=f"oceanet/{secret_name}",
                    SecretString=new_value,
                )
                return True
            
            # Local rotation (not secure, dev only)
            os.environ[secret_name.upper()] = new_value
            return True
        except Exception as e:
            print(f"Error rotating secret: {e}")
            return False


# Global secrets manager instance
secrets_manager = SecretsManager()


def get_secret(name: str, default: Optional[str] = None) -> str:
    """Convenience function to get secrets"""
    return secrets_manager.get_secret(name, default)
