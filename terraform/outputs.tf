output "instance_public_ip" {
  description = "Public IP of wallpaper EC2"
  value       = aws_instance.app.public_ip

}


output "instance_private_ip" {
  description = "Private IP of wallpaper EC2"
  value       = aws_instance.app.private_ip

}


output "github_actions_role_arn" {
  description = "IAM role used by GitHub Actions via OIDC"
  value       = aws_iam_role.github_actions.arn
}